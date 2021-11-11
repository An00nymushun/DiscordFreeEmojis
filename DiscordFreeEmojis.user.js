// ==UserScript==
// @name         DiscordFreeEmojis
// @namespace    https://gitlab.com/An0/DiscordFreeEmojis
// @version      1.6.0.0
// @description  Link emojis if you don't have nitro!
// @author       An0
// @license      LGPLv3 - https://www.gnu.org/licenses/lgpl-3.0.txt
// @downloadURL  https://gitlab.com/An0/DiscordFreeEmojis/-/raw/master/DiscordFreeEmojis.user.js
// @updateURL    https://gitlab.com/An0/DiscordFreeEmojis/-/raw/master/DiscordFreeEmojis.meta.js
// @match        https://*.discord.com/channels/*
// @match        https://*.discord.com/activity
// @match        https://*.discord.com/login*
// @match        https://*.discord.com/app
// @match        https://*.discord.com/library
// @match        https://*.discord.com/store
// @grant        unsafeWindow
// ==/UserScript==


(function() {

'use strict';

const BaseColor = "#0cf";

var Discord;
var Utils = {
    Log: (message) => { console.log(`%c[FreeEmojis] %c${message}`, `color:${BaseColor};font-weight:bold`, "") },
    Warn: (message) => { console.warn(`%c[FreeEmojis] %c${message}`, `color:${BaseColor};font-weight:bold`, "") },
    Error: (message) => { console.error(`%c[FreeEmojis] %c${message}`, `color:${BaseColor};font-weight:bold`, "") },
    Webpack: function() {
        if(this.cachedWebpack) return this.cachedWebpack;

        let webpackExports;

        if(typeof BdApi !== "undefined" && BdApi?.findModuleByProps && BdApi?.findModule) {
            return this.cachedWebpack = { findModule: BdApi.findModule, findModuleByUniqueProperties: (props) => BdApi.findModuleByProps.apply(null, props) };
        }
        else if(Discord.window.webpackChunkdiscord_app != null) {
            const ids = ['__extra_id__'];
            Discord.window.webpackChunkdiscord_app.push([
                ids,
                {},
                (req) => {
                    webpackExports = req;
                    ids.length = 0;
                }
            ]);
        }
        else if(Discord.window.webpackJsonp != null) {
            webpackExports = typeof(Discord.window.webpackJsonp) === 'function' ?
            Discord.window.webpackJsonp(
                [],
                { '__extra_id__': (module, _export_, req) => { _export_.default = req } },
                [ '__extra_id__' ]
            ).default :
            Discord.window.webpackJsonp.push([
                [],
                { '__extra_id__': (_module_, exports, req) => { _module_.exports = req } },
                [ [ '__extra_id__' ] ]
            ]);

            delete webpackExports.m['__extra_id__'];
            delete webpackExports.c['__extra_id__'];
        }
        else return null;

        const findModule = (filter) => {
            for(let i in webpackExports.c) {
                if(webpackExports.c.hasOwnProperty(i)) {
                    let m = webpackExports.c[i].exports;

                    if(!m) continue;

                    if(m.__esModule && m.default) m = m.default;

                    if(filter(m)) return m;
                }
            }

            return null;
        };

        const findModuleByUniqueProperties = (propNames) => findModule(module => propNames.every(prop => module[prop] !== undefined));

        return this.cachedWebpack = { findModule, findModuleByUniqueProperties };
    }
};


function Init(final)
{
    Discord = { window: (typeof(unsafeWindow) !== 'undefined') ? unsafeWindow : window };

    const webpackUtil = Utils.Webpack();
    if(webpackUtil == null) { if(final) Utils.Error("Webpack not found."); return 0; }
    const { findModule, findModuleByUniqueProperties } = webpackUtil;

    let emojisModule = findModuleByUniqueProperties([ 'getDisambiguatedEmojiContext', 'searchWithoutFetchingLatest' ]);
    if(emojisModule == null) { if(final) Utils.Error("emojisModule not found."); return 0; }

    let messageEmojiParserModule = findModuleByUniqueProperties([ 'parse', 'parsePreprocessor', 'unparse' ]);
    if(messageEmojiParserModule == null) { if(final) Utils.Error("messageEmojiParserModule not found."); return 0; }

    let emojiPickerModule = findModuleByUniqueProperties([ 'useEmojiSelectHandler' ]);
    if(emojiPickerModule == null) { if(final) Utils.Error("emojiPickerModule not found."); return 0; }

    const original_searchWithoutFetchingLatest = emojisModule.searchWithoutFetchingLatest;
    emojisModule.searchWithoutFetchingLatest = function() {
        let result = original_searchWithoutFetchingLatest.apply(this, arguments);
        result.unlocked.push(...result.locked);
        result.locked = [];
        return result;
    }

    function replaceEmoji(parseResult, emoji) {
        parseResult.content = parseResult.content.replace(`<${emoji.animated ? "a" : ""}:${emoji.originalName || emoji.name}:${emoji.id}>`, emoji.url.split("?")[0] + "?size=48");
    }
	
    const original_parse = messageEmojiParserModule.parse;
    messageEmojiParserModule.parse = function() {
        let result = original_parse.apply(this, arguments);

        if(result.invalidEmojis.length !== 0) {
            for(let emoji of result.invalidEmojis) {
                replaceEmoji(result, emoji);
            }
            result.invalidEmojis = [];
        }
        let validNonShortcutEmojis = result.validNonShortcutEmojis;
        for (let i = 0; i < validNonShortcutEmojis.length; i++) {
            const emoji = validNonShortcutEmojis[i];
            if(!emoji.available) {
                replaceEmoji(result, emoji);
                validNonShortcutEmojis.splice(i, 1);
                i--;
            }
        }

        return result;
    };

    const original_useEmojiSelectHandler = emojiPickerModule.useEmojiSelectHandler;
    emojiPickerModule.useEmojiSelectHandler = function(args) {
		const { onSelectEmoji, closePopout } = args;
		const originalHandler = original_useEmojiSelectHandler.apply(this, arguments);
		return function(data, state) {
			if(state.toggleFavorite)
				return originalHandler.apply(this, arguments);
			
			const emoji = data.emoji;
			if(emoji != null) {
				onSelectEmoji(emoji, state.isFinalSelection);
				if(state.isFinalSelection) closePopout();
			}
		};
    };

    Utils.Log("loaded");

    return 1;
}


var InitFails = 0;
function TryInit()
{
    if(Init() !== 0) return;

    window.setTimeout((++InitFails === 600) ? Init : TryInit, 100, true);
};


TryInit();

})();
