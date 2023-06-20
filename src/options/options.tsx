import { h, render } from "preact"
import { getTranslation, localizationKeys, setLocaleLanguage } from "src/util/localization"
import { useLayoutEffect, useState } from "preact/hooks"
import PromptEditor from "src/components/promptEditor"
import NavBar from "src/components/navBar"
import { getUserConfig, updateUserConfig } from "src/util/userConfig"
import "../style/base.css"
import OptionsEditor from "src/components/optionsEditor"


const Footer = () => (
    <div className="wcg-flex wcg-flex-col wcg-items-center wcg-p-4" >

    </div>
)

export default function OptionsPage() {

    const [language, setLanguage] = useState<string | null>(null)


    useLayoutEffect(() => {
        getUserConfig().then(config => {
            setLanguage(config.language)
            setLocaleLanguage(config.language)
        })
    }, [])

    const onLanguageChange = (language: string) => {
        setLanguage(language)
        updateUserConfig({ language })
        setLocaleLanguage(language)
    }

    if (!language) {
        return <div />
    }

    return (
        <div className="wcg-flex wcg-w-5/6 wcg-flex-col wcg-items-center">

            <NavBar
                language={language}
                onLanguageChange={onLanguageChange}
            />
            <div className="wcg-flex wcg-w-full wcg-flex-col wcg-items-center wcg-gap-4 md:wcg-w-4/5">

                <PromptEditor
                    language={language}
                />

                <div className="wcg-divider wcg-m-0 wcg-w-4/5 wcg-self-center" />

                <OptionsEditor />

                <div className="wcg-divider wcg-m-0 wcg-w-4/5 wcg-self-center" />

                <div className="wcg-flex wcg-flex-col wcg-items-center wcg-self-center">
                    {/* <div className="wcg-flex wcg-flex-row wcg-gap-4">
                        <SocialCard icon={icons.twitter} text={getTranslation(localizationKeys.socialButtonTips.twitter)} url="https://twitter.com/hahahahohohe" />
                        <SocialCard icon={icons.discord} text={getTranslation(localizationKeys.socialButtonTips.discord)} url="https://discord.gg/hjvAtVNtHa" />
                        <SocialCard icon={icons.github} text={getTranslation(localizationKeys.socialButtonTips.github)} url="https://github.com/qunash/chatgpt-advanced" />
                    </div> */}
                    <Footer />
                </div>
            </div>

        </div >
    )
}


render(<OptionsPage />, document.getElementById("options") as Element)
