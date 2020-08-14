// ==UserScript==
// @name         DiscordFreeEmojis
// @namespace    https://gitlab.com/An0/DiscordFreeEmojis
// @version      1.1
// @description  Link emojis if you don't have nitro!
// @author       An0
// @license      LGPLv3 - https://www.gnu.org/licenses/lgpl-3.0.txt
// @downloadURL  https://gitlab.com/An0/DiscordFreeEmojis/-/raw/master/DiscordFreeEmojis64px.user.js
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
    Error: (message) => { console.error(`%c[FreeEmojis] %c${message}`, `color:${BaseColor};font-weight:bold`, "") }
};

function Init(nonInvasive)
{
    Discord = { window: (typeof(unsafeWindow) !== 'undefined') ? unsafeWindow : window };

    if(Discord.window.webpackJsonp == null) { if(!nonInvasive) Utils.Error("Webpack not found."); return 0; }

    const webpackExports = typeof(Discord.window.webpackJsonp) === 'function' ?
          Discord.window.webpackJsonp(
              [],
              { '__extra_id__': (module, _export_, req) => { _export_.default = req } },
              [ '__extra_id__' ]
          ).default :
          Discord.window.webpackJsonp.push( [
              [],
              { '__extra_id__': (_module_, exports, req) => { _module_.exports = req } },
              [ [ '__extra_id__' ] ] ]
          );

    delete webpackExports.m['__extra_id__'];
    delete webpackExports.c['__extra_id__'];

    const findModule = (filter, nonInvasive) => {
        for(let i in webpackExports.c) {
            if(webpackExports.c.hasOwnProperty(i)) {
                let m = webpackExports.c[i].exports;

                if(!m) continue;

                if(m.__esModule && m.default) m = m.default;

                if(filter(m)) return m;
            }
        }

        if (!nonInvasive) {
            console.warn("Couldn't find module in existing cache. Loading all modules.");

            for (let i = 0; i < webpackExports.m.length; i++) {
                try {
                    let m = webpackExports(i);

                    if(!m) continue;

                    if(m.__esModule && m.default) m = m.default;

                    if(filter(m)) return m;
                }
                catch (e) { }
            }

            console.warn("Cannot find module.");
        }

        return null;
    };

    const findModuleByUniqueProperties = (propNames, nonInvasive) => findModule(module => propNames.every(prop => module[prop] !== undefined), nonInvasive);

    let emojisModule = findModuleByUniqueProperties([ 'getDisambiguatedEmojiContext', 'filterExternal' ], nonInvasive);
	if(emojisModule == null) { if(!nonInvasive) Utils.Error("emojisModule not found."); return 0; }

	let messageEmojiParserModule = findModuleByUniqueProperties([ 'parse', 'parsePreprocessor', 'unparse' ], nonInvasive);
	if(messageEmojiParserModule == null) { if(!nonInvasive) Utils.Error("messageEmojiParserModule not found."); return 0; }
	
	let emojiPickerModule = findModuleByUniqueProperties([ 'useEmojiSelectHandler' ], nonInvasive);
	if(emojiPickerModule == null) { if(!nonInvasive) Utils.Error("emojiPickerModule not found."); return 0; }

	const original_filterExternal = emojisModule.filterExternal;
	emojisModule.filterExternal = function(guild, query, n) {
		let emojis = emojisModule.getDisambiguatedEmojiContext(guild ? guild.guild_id : null).nameMatchesChain(query);
		if(n > 0) emojis = emojis.take(n);
		return emojis.value();
	}

	const original_parse = messageEmojiParserModule.parse;
	messageEmojiParserModule.parse = function() {
		let result = original_parse.apply(this, arguments);
		if(result.invalidEmojis.length !== 0) {
			for(let emoji of result.invalidEmojis) {
				result.content = result.content.replace(`<${emoji.animated ? "a" : ""}:${emoji.originalName || emoji.name}:${emoji.id}>`, emoji.url.split("?")[0] + "?size=64");
			}
			result.invalidEmojis = [];
		}
		return result;
	};

	const original_useEmojiSelectHandler = emojiPickerModule.useEmojiSelectHandler;
	emojiPickerModule.useEmojiSelectHandler = function(args) {
		const { onSelectEmoji, closePopout } = args;
		return function(data, state) {
			const emoji = data.emoji;
			if(emoji != null && emoji.available) {
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
    if(Init(true) !== 0) return;

    window.setTimeout((++InitFails === 600) ? Init : TryInit, 100);
};


TryInit();

})();
