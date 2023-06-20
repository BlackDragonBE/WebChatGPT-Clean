import { h } from 'preact'
import Browser from 'webextension-polyfill'

function Footer() {
  const extension_version = Browser.runtime.getManifest().version

  return (
    <div className="wcg-text-center wcg-text-xs wcg-text-gray-400">
      <a href='https://github.com/BlackDragonBE/WebChatGPT-Clean' target='_blank' className='underline wcg-text-gray-400 wcg-underline' rel="noreferrer noopener">
        WebChatGPT-Clean extension v.{extension_version}
      </a>.
    </div>
  )
}

export default Footer
