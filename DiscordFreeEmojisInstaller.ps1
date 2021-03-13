$ErrorActionPreference = "Stop"

function AddExtension([string]$electonDataPath) {
	'adding extension'
	$extensionListPath = "$electonDataPath\DevTools Extensions"
	if(Test-Path $extensionListPath) {
		$extensionList = ConvertFrom-Json (Get-Content $extensionListPath -Raw)
		$extensionList = @($extensionList | ? { $_ -notmatch '(?:^|[\\\/])DiscordFreeEmojis[\\\/]?$' })
		if($extensionList.Length -ne 0) {
			$extensionList += '../../DiscordFreeEmojis'
			Set-Content $extensionListPath (ConvertTo-Json $extensionList)
			return
		}
	}
	Set-Content $extensionListPath '["../../DiscordFreeEmojis"]'
}

function StopProcesses([string]$name) {
	$targets = Get-Process $name -ErrorAction SilentlyContinue
	if($targets.Length -eq 0) { return }
    try {
		$targets | Stop-Process
    } catch { "PLEASE CLOSE $name!" }
	"waiting for $name to close"
	do {
		sleep 1
		$targets = Get-Process $name -ErrorAction SilentlyContinue
	} while($targets.Length -gt 0)
}

$discordPath = $env:LOCALAPPDATA+'\Discord'
$discordDataPath = $env:APPDATA+'\discord'
$discordResourcesPath = $discordPath+'\app-*\resources'
$discordPtbPath = $env:LOCALAPPDATA+'\DiscordPTB'
$discordPtbDataPath = $env:APPDATA+'\discordptb'
$discordPtbResourcesPath = $discordPtbPath+'\app-*\resources'
$discordCanaryPath = $env:LOCALAPPDATA+'\DiscordCanary'
$discordCanaryDataPath = $env:APPDATA+'\discordcanary'
$discordCanaryResourcesPath = $discordCanaryPath+'\app-*\resources'
$pluginPath = $env:LOCALAPPDATA+'\DiscordFreeEmojis'


$install = $false

try {

if(Test-Path $discordPath) {
	'Discord found'
	if(Test-Path $discordDataPath) { 'data directory found' } else { 'data directory not found'; return }
	if(Test-Path $discordResourcesPath) { 'resources directory found' } else { 'resources directory not found'; return }
	
	StopProcesses 'Discord'

	AddExtension $discordDataPath

	$install = $true
}

if(Test-Path $discordPtbPath) {
	'DiscordPTB found'
	if(Test-Path $discordPtbDataPath) { 'data directory found' } else { 'data directory not found'; return }
	if(Test-Path $discordPtbResourcesPath) { 'resources directory found' } else { 'resources directory not found'; return }
	
	StopProcesses 'DiscordPTB'

	AddExtension $discordPtbDataPath

	$install = $true
}

if(Test-Path $discordCanaryPath) {
	'DiscordCanary found'
	if(Test-Path $discordCanaryDataPath) { 'data directory found' } else { 'data directory not found'; return }
	if(Test-Path $discordCanaryResourcesPath) { 'resources directory found' } else { 'resources directory not found'; return }
	
	StopProcesses 'DiscordCanary'
	
	AddExtension $discordCanaryDataPath

	$install = $true
}


if($install) {
	'installing'

	[void](New-Item "$pluginPath\manifest.json" -Type File -Force -Value @'
{
	"name": "DiscordFreeEmojis",
	"content_scripts": [ {
		"js": [ "DiscordFreeEmojisLoader.js" ],
		"matches": [ "*" ],
		"run_at": "document_start"
	} ]
}
'@)

	[void](New-Item "$pluginPath\DiscordFreeEmojisLoader.js" -Type File -Force -Value @'
// https://gitlab.com/An0/DiscordFreeEmojis

let script = document.createElement('script');
script.textContent = `
(()=>{
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

    let emojisModule = findModuleByUniqueProperties([ 'getDisambiguatedEmojiContext', 'search' ], nonInvasive);
    if(emojisModule == null) { if(!nonInvasive) Utils.Error("emojisModule not found."); return 0; }

    let messageEmojiParserModule = findModuleByUniqueProperties([ 'parse', 'parsePreprocessor', 'unparse' ], nonInvasive);
    if(messageEmojiParserModule == null) { if(!nonInvasive) Utils.Error("messageEmojiParserModule not found."); return 0; }
    
    let emojiPickerModule = findModuleByUniqueProperties([ 'useEmojiSelectHandler' ], nonInvasive);
    if(emojiPickerModule == null) { if(!nonInvasive) Utils.Error("emojiPickerModule not found."); return 0; }

    const original_search = emojisModule.search;
    emojisModule.search = function() {
        let result = Discord.original_search.apply(this, arguments);
        result.unlocked.push(...result.locked);
        result.locked = [];
        return result;
    }

    const original_parse = messageEmojiParserModule.parse;
    messageEmojiParserModule.parse = function() {
        let result = original_parse.apply(this, arguments);
        if(result.invalidEmojis.length !== 0) {
            for(let emoji of result.invalidEmojis) {
                result.content = result.content.replace(`<${emoji.animated ? "a" : ""}:${emoji.originalName || emoji.name}:${emoji.id}>`);
            }
            result.invalidEmojis = [];
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
`;
(document.head||document.documentElement).appendChild(script);
script.remove();
'@)

	'FINISHED'
}
else { 'Discord not found' }

}
catch { $_ }
finally { [Console]::ReadLine() }
