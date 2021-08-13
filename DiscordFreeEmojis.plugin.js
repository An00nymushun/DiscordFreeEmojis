//META{"name":"FreeEmojis"}*//
/**
 * @name DiscordFreeEmojis
 * @website https://github.com/An00nymushun/DiscordFreeEmojis
 * @source https://github.com/An00nymushun/DiscordFreeEmojis/blob/master/DiscordFreeEmojis.plugin.js
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
    Error: (message) => { console.error(`%c[FreeEmojis] %c${message}`, `color:${BaseColor};font-weight:bold`, "") }
};

var Initialized = false;
var searchHook;
var parseHook;
var useEmojiSelectHandlerHook;
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

    let emojisModule = findModuleByUniqueProperties([ 'getDisambiguatedEmojiContext', 'search' ], nonInvasive);
    if(emojisModule == null) { if(!nonInvasive) Utils.Error("emojisModule not found."); return 0; }

    let messageEmojiParserModule = findModuleByUniqueProperties([ 'parse', 'parsePreprocessor', 'unparse' ], nonInvasive);
    if(messageEmojiParserModule == null) { if(!nonInvasive) Utils.Error("messageEmojiParserModule not found."); return 0; }

    let emojiPickerModule = findModuleByUniqueProperties([ 'useEmojiSelectHandler' ], nonInvasive);
    if(emojiPickerModule == null) { if(!nonInvasive) Utils.Error("emojiPickerModule not found."); return 0; }

    Discord.EmojisModule = emojisModule;
    searchHook = Discord.original_search = emojisModule.search;
    emojisModule.search = function() { return searchHook.apply(this, arguments); };

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

    const { EmojisModule, original_parse, original_useEmojiSelectHandler } = Discord;

    searchHook = function() {
        let result = Discord.original_search.apply(this, arguments);
        result.unlocked.push(...result.locked);
        result.locked = [];
        return result;
    }

    parseHook = function() {
        let result = original_parse.apply(this, arguments);
        if(result.invalidEmojis.length !== 0) {
            for(let emoji of result.invalidEmojis) {
                result.content = result.content.replace(`<${emoji.animated ? "a" : ""}:${emoji.originalName || emoji.name}:${emoji.id}>`, emoji.url);
            }
            result.invalidEmojis = [];
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
            if(emoji != null && emoji.available) {
                onSelectEmoji(emoji, state.isFinalSelection);
                if(state.isFinalSelection) closePopout();
            }
        };
    };
}

function Stop() {
    if(!Initialized) return;

    searchHook = Discord.original_search;
    parseHook = Discord.original_parse;
    useEmojiSelectHandlerHook = Discord.original_useEmojiSelectHandler;
}

return function() { return {
    getName: () => "DiscordFreeEmojis",
    getShortName: () => "FreeEmojis",
    getDescription: () => "Link emojis if you don't have nitro! Type them out or use the emoji picker!",
    getVersion: () => "1.3",
    getAuthor: () => "An0",

    start: Start,
    stop: Stop
}};

})();

module.exports = FreeEmojis;

/*@end @*/
