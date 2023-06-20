import cheerio from 'cheerio'
import Browser from 'webextension-polyfill'

const BASE_URL = 'https://sg.search.yahoo.com/search'

export interface SearchRequest {
    query: string
    timerange: string
    region: string
}

export interface SearchResponse {
    status: number
    html: string
    url: string
}

export interface SearchResult {
    title: string
    body: string
    url: string
}

export async function getHtml({ query, timerange }: SearchRequest): Promise<SearchResponse> {

    const params = new URLSearchParams({
        q: query,
        btf: timerange,
        nojs: '1',
        ei: 'UTF-8',
    })
    const response = await fetch(`${BASE_URL}?${params.toString()}`)

    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
    }

    return { status: response.status, html: await response.text(), url: response.url }
}

function extractRealUrl(url: string): string {
    const match = url.match(/RU=([^/]+)/)
    if (match && match[1]) {
        return decodeURIComponent(match[1])
    }

    return url
}

async function htmlToSearchResults(html: string, numResults: number): Promise<SearchResult[]> {
    const $ = cheerio.load(html)
    const results: SearchResult[] = []

    const rightPanel = $('#right .searchRightTop')
    if (rightPanel.length) {
        const rightPanelLink = rightPanel.find('.compText a').first()
        const rightPanelInfo = rightPanel.find('.compInfo li')
        const rightPanelInfoText = rightPanelInfo
            .map((_, el) => $(el).text().trim())
            .get()
            .join('\n')

        results.push({
            title: rightPanelLink.text().trim(),
            body: `${rightPanel.find('.compText').text().trim()}${rightPanelInfoText ? `\n\n${rightPanelInfoText}` : ''}`,
            url: extractRealUrl(rightPanelLink.attr('href') ?? ''),
        })
    }

    const searchResults = $('.algo-sr:not([class*="ad"])').slice(0, numResults)
    for (let i = 0; i < searchResults.length; i++) {
        const element = $(searchResults[i])
        const titleElement = element.find('h3.title a')

        // console.log(extractRealUrl(titleElement.attr('href') ?? ''));
        var real_url = extractRealUrl(titleElement.attr('href') ?? '')
        // const text = await getPageContent(real_url);
        // console.log(text);
        results.push({
            title: titleElement.attr('aria-label') ?? '',
            body: element.find('.compText').text().trim(),
            url: real_url,
        })
    }

    return results
}

async function getPageContent(url: string): Promise<string> {
    try {
        const res = await fetch(url);
        return await res.text();
    } catch (error) {
        console.error(error);
        throw new Error("Failed to fetch page content");
    }
}

export async function webSearch(search_request: SearchRequest, numResults: number): Promise<SearchResult[]> {
    // const searchResults = await search(search_request.query, {
    //     safeSearch: SafeSearchType.STRICT
    //   });
    // console.log(searchResults)

    const response: SearchResponse = await Browser.runtime.sendMessage({
        type: "get_search_results",
        search: search_request
    })

    let results: SearchResult[]
    if (response.url.startsWith(BASE_URL)) {
        results = await htmlToSearchResults(response.html, numResults)
    } else {
        const result = await Browser.runtime.sendMessage({
            type: "get_webpage_text",
            url: response.url,
            html: response.html
        })

        return [{
            title: result.title,
            body: result.body,
            url: response.url
        }]
    }

    return results
}
