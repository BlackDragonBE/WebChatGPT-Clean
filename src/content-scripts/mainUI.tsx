import '../style/base.css';
import { h, render } from 'preact';
import { getTextArea, getFooter, getRootElement, getSubmitButton, getWebChatGPTToolbar } from '../util/elementFinder';
import Toolbar from 'src/components/toolbar';
import ErrorMessage from 'src/components/errorMessage';
import { getUserConfig, UserConfig } from 'src/util/userConfig';
import { SearchRequest, SearchResult, webSearch } from './web_search';

import createShadowRoot from 'src/util/createShadowRoot';
import { compilePrompt, promptContainsWebResults } from 'src/util/promptManager';
import SlashCommandsMenu, { slashCommands } from 'src/components/slashCommandsMenu';
import { apiExtractText } from './api';

let isProcessing = false;
let updatingUI = false;

const rootEl = getRootElement();
let btnSubmit: HTMLButtonElement | null | undefined;
let textarea: HTMLTextAreaElement | null;
let chatGptFooter: HTMLDivElement | null;
let toolbar: HTMLElement | null;

function renderSlashCommandsMenu() {
  let div = document.querySelector('div.wcg-slash-commands-menu');
  if (div) div.remove();

  div = document.createElement('div');
  div.className = 'wcg-slash-commands-menu';
  const textareaParentParent = textarea?.parentElement?.parentElement;

  textareaParentParent?.insertBefore(div, textareaParentParent.firstChild);
  render(<SlashCommandsMenu textarea={textarea} />, div);
}

async function processQuery(query: string, userConfig: UserConfig) {
  const containsWebResults = await promptContainsWebResults();
  if (!containsWebResults) {
    return undefined;
  }

  let results: SearchResult[];

  const pageCommandMatch = query.match(/page:(\S+)/);
  if (pageCommandMatch) {
    const url = pageCommandMatch[1];
    results = await apiExtractText(url);
  } else {
    const searchRequest: SearchRequest = {
      query,
      timerange: userConfig.timePeriod,
      region: userConfig.region,
    };

    results = await webSearch(searchRequest, userConfig.numWebResults);
  }

  return results;
}

/**
 * Submits a query by processing it with the user's configuration and updating the textarea.
 * @param user_query - The query to be processed.
 */
async function handleSubmit(user_query: string) {
  console.log('WebChatGPT: handleSubmit');

  // Check if textarea exists before continuing
  if (!textarea) return;

  // Get the user's configuration
  const userConfig = await getUserConfig();

  // Check if web access is enabled in the user's configuration before continuing, else just submit their text
  if (!userConfig.webAccess){
    clickSubmitButton();
    return;
  }

  try {
    // Process the query with the user's configuration
    const results = await processQuery(user_query, userConfig);

    // Compile the processed results and original query into a prompt string
    const compiledPrompt = await compilePrompt(results, user_query);

    // Update the textarea with the prompt string
    textarea.value = compiledPrompt;

    // Trigger an input event on the textarea to notify any listeners of the change
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    // Simulate pressing the submit button
    clickSubmitButton();
  } catch (error) {
    // If an error occurs during processing, display an error message
    if (error instanceof Error) showErrorMessage(error);
  }
}

async function onSubmit(event: MouseEvent | KeyboardEvent) {
  //   // Get the user's configuration
  //   const userConfig = await getUserConfig();

  //   // Check if web access is enabled in the user's configuration before continuing
  //   if (!userConfig.webAccess) return;

  if (!textarea) return;

  const isKeyEvent = event instanceof KeyboardEvent;
  if (isKeyEvent && event.shiftKey && event.key === 'Enter') return;

  if (isKeyEvent && event.key === 'Enter' && event.isComposing) return;

  if ((!isProcessing && event.type === 'click') || (isKeyEvent && event.key === 'Enter')) {
    console.info('WebChatGPT: onSubmit');
    const user_query = textarea?.value.trim();

    if (!user_query) return;
    const isPartialCommand = slashCommands.some((command) => command.name.startsWith(user_query) && user_query.length <= command.name.length);
    if (isPartialCommand) {
      return;
    }

    console.log(textarea.value);
    event.preventDefault();
    event.stopPropagation();

    isProcessing = true;
    await handleSubmit(user_query);
    isProcessing = false;

    //Trigger event
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/**
 * Clicks the submit button on the web page.
 *
 * @return {Promise<void>} A Promise that resolves when the button is clicked.
 */
async function clickSubmitButton() {
  console.log('WebChatGPT: clickSubmitButton');

  if (textarea) {
    textarea.focus();
    // Wait for btnSubmit to be enabled
    while (btnSubmit?.disabled) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter' }));
    btnSubmit?.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

function showErrorMessage(error: Error) {
  console.info('WebChatGPT error --> API error: ', error);
  const div = document.createElement('div');
  document.body.appendChild(div);
  render(<ErrorMessage message={error.message} />, div);
}

async function updateUI() {
  if (updatingUI) return;

  updatingUI = true;

  textarea = getTextArea();
  toolbar = getWebChatGPTToolbar();
  // console.info("toolbar --> ", toolbar)
  if (!textarea) {
    toolbar?.remove();
    return;
  }

  if (toolbar) return;

  console.info('WebChatGPT: Updating UI');

  btnSubmit = getSubmitButton();
  btnSubmit?.addEventListener('click', onSubmit);
  textarea?.addEventListener('keydown', onSubmit);

  await renderToolbar();

  renderSlashCommandsMenu();

  chatGptFooter = getFooter();
  if (chatGptFooter) {
    const lastChild = chatGptFooter.lastElementChild as HTMLElement;
    if (lastChild) lastChild.style.padding = '0 0 0.5em 0';
  }

  updatingUI = false;
}

async function renderToolbar() {
  try {
    const textareaParentParent = textarea?.parentElement?.parentElement;
    const { shadowRootDiv, shadowRoot } = await createShadowRoot('content-scripts/mainUI.css');
    shadowRootDiv.classList.add('wcg-toolbar');
    textareaParentParent?.appendChild(shadowRootDiv);
    render(<Toolbar textarea={textarea} />, shadowRoot);
  } catch (e) {
    if (e instanceof Error) {
      showErrorMessage(Error(`Error loading WebChatGPT toolbar: ${e.message}. Please reload the page (F5).`));
    }
  }
}

const mutationObserver = new MutationObserver((mutations) => {
  if (!mutations.some((mutation) => mutation.removedNodes.length > 0)) return;

  // console.info("WebChatGPT: Mutation observer triggered")

  if (getWebChatGPTToolbar()) return;

  try {
    updateUI();
  } catch (e) {
    if (e instanceof Error) {
      showErrorMessage(e);
    }
  }
});

window.onload = function () {
  updateUI();

  mutationObserver.observe(rootEl, { childList: true, subtree: true });
};

window.onunload = function () {
  mutationObserver.disconnect();
};
