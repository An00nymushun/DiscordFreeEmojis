/**
 * @name FreeEmojis
 * @author An0
 * @version 1.6
 * @description Link emojis if you don't have nitro! Type them out or use the emoji picker! [64px]
 * @source https://github.com/An00nymushun/DiscordFreeEmojis
 * @updateUrl https://raw.githubusercontent.com/An00nymushun/DiscordFreeEmojis/master/DiscordFreeEmojis64px.plugin.js
 */

/*@cc_on
@if (@_jscript)
    var shell = WScript.CreateObject("WScript.Shell");
    var fs = new ActiveXObject("Scripting.FileSystemObject");
    var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\BetterDiscord\\plugins");
    var pathSelf = WScript.ScriptFullName;
    shell.Popup("It looks like you've mistakenly tried to run me directly. \\n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
    if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
        shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
    } else if (!fs.FolderExists(pathPlugins)) {
        shell.Popup("I can't find the BetterDiscord plugins folder.\\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
    } else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
        fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
        // Show the user where to put plugins in the future
        shell.Exec("explorer " + pathPlugins);
        shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
    }
    WScript.Quit();
@else @*/


var FreeEmojis = (() => {

'use strict';

const BaseColor = "#0cf";

var Discord;
var Utils = {
    Log: (message) => { console.log(`%c[FreeEmojis] %c${message}`, `color:${BaseColor};font-weight:bold`, "") },
    Warn: (message) => { console.warn(`%c[FreeEmojis] %c${message}`, `color:${BaseColor};font-weight:bold`, "") },
    Error: (message) => { console.error(`%c[FreeEmojis] %c${message}`, `color:${BaseColor};font-weight:bold`, "") },
    Webpack: () => {
        let webpackExports;

        if(typeof BdApi !== "undefined" && BdApi?.findModuleByProps && BdApi?.findModule) {
            return { findModule: BdApi.findModule, findModuleByUniqueProperties: (props) => BdApi.findModuleByProps.apply(null, props) };
        }
        else if(Discord.window.webpackChunkdiscord_app != null) {
            Discord.window.webpackChunkdiscord_app.push([
                ['__extra_id__'],
                {},
                req => webpackExports = req
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
        }
        else return null;
    
        delete webpackExports.m['__extra_id__'];
        delete webpackExports.c['__extra_id__'];
    
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

        return { findModule, findModuleByUniqueProperties };
    }
};

var Initialized = false;
var searchHook;
var parseHook;
var useEmojiSelectHandlerHook;
function Init()
{
    Discord = { window: (typeof(unsafeWindow) !== 'undefined') ? unsafeWindow : window };

    const webpackUtil = Utils.Webpack();
    if(webpackUtil == null) { Utils.Error("Webpack not found."); return 0; }
    const { findModule, findModuleByUniqueProperties } = webpackUtil;

    let emojisModule = findModuleByUniqueProperties([ 'getDisambiguatedEmojiContext', 'searchWithoutFetchingLatest' ]);
    if(emojisModule == null) { Utils.Error("emojisModule not found."); return 0; }

    let messageEmojiParserModule = findModuleByUniqueProperties([ 'parse', 'parsePreprocessor', 'unparse' ]);
    if(messageEmojiParserModule == null) { Utils.Error("messageEmojiParserModule not found."); return 0; }

    let emojiPickerModule = findModuleByUniqueProperties([ 'useEmojiSelectHandler' ]);
    if(emojiPickerModule == null) { Utils.Error("emojiPickerModule not found."); return 0; }

    searchHook = Discord.original_searchWithoutFetchingLatest = emojisModule.searchWithoutFetchingLatest;
    emojisModule.searchWithoutFetchingLatest = function() { return searchHook.apply(this, arguments); };

    parseHook = Discord.original_parse = messageEmojiParserModule.parse;
    messageEmojiParserModule.parse = function() { return parseHook.apply(this, arguments); };

    useEmojiSelectHandlerHook = Discord.original_useEmojiSelectHandler = emojiPickerModule.useEmojiSelectHandler;
    emojiPickerModule.useEmojiSelectHandler = function() { return useEmojiSelectHandlerHook.apply(this, arguments); };

    Utils.Log("initialized");
    Initialized = true;

    return 1;
}

function Start() {
    if(!Initialized && Init() !== 1) return;

    const { original_parse, original_useEmojiSelectHandler } = Discord;

    searchHook = function() {
        let result = Discord.original_searchWithoutFetchingLatest.apply(this, arguments);
        result.unlocked.push(...result.locked);
        result.locked = [];
        return result;
    }

    function replaceEmoji(parseResult, emoji) {
        parseResult.content = parseResult.content.replace(`<${emoji.animated ? "a" : ""}:${emoji.originalName || emoji.name}:${emoji.id}>`, emoji.url.split("?")[0] + "?size=64");
    }

    parseHook = function() {
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

    useEmojiSelectHandlerHook = function(args) {
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
}

function Stop() {
    if(!Initialized) return;

    searchHook = Discord.original_searchWithoutFetchingLatest;
    parseHook = Discord.original_parse;
    useEmojiSelectHandlerHook = Discord.original_useEmojiSelectHandler;
}

return function() { return {
    getName: () => "DiscordFreeEmojis",
    getShortName: () => "FreeEmojis",
    getDescription: () => "Link emojis if you don't have nitro! Type them out or use the emoji picker! [64px]",
    getVersion: () => "1.6",
    getAuthor: () => "An0",

    start: Start,
    stop: Stop
}};

})();

module.exports = FreeEmojis;

/*@end @*/
