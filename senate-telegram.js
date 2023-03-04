import prompt from 'prompt-sync';
import {fetchAPI, loadFromCache, saveToCache, sleep} from './utils.js';
import * as logger from "./logger.js";
import fs from "fs";

const input = prompt({sigint: true});
const dispatchRegex = new RegExp('[0-9]+');

//probably a better way to do this but fuck regex
const aliasRegex = new RegExp('\\[tr]\\[td]\\[nation]([A-Za-z0-9]+( [A-Za-z0-9]+)*)\\[\\/nation] \\(\\[nation]([a-zA-Z0-9]+( [a-zA-z0-9]+)*)\\[\\/nation]\\)\\[\\/td]\\[td]\\[i](.+( .+)+)\\[\\/i]\\[\\/td]\\[td]([A-Za-z0-9]+)\\[\\/td]\\[td]([0-9]+(\\/[0-9]+)+)\\[\\/td]\\[\\/tr]', 'g');
const singleRegex = new RegExp('\\[tr]\\[td]\\[nation]([A-Za-z0-9]+( [A-Za-z0-9]+)*)\\[\\/nation]\\[\\/td]\\[td]\\[i](.+( .+)+)\\[\\/i]\\[\\/td]\\[td]([A-Za-z0-9]+)\\[\\/td]\\[td]([0-9]+(\\/[0-9]+)+)\\[\\/td]\\[\\/tr]', 'g');
const singleExpiredRegex = new RegExp('\\[tr]\\[td]\\[nation]([A-Za-z0-9]+( [A-Za-z0-9]+)*)\\[\\/nation]\\[\\/td]\\[td]\\[i](.+( .+)+)\\[\\/i]\\[\\/td]\\[td]([A-Za-z0-9]+)\\[\\/td]\\[td]\\[b]([0-9]+(\\/[0-9]+)+)\\[\\/b]\\[\\/td]\\[\\/tr]', 'g');
const aliasExpiredRegex = new RegExp('\\[tr]\\[td]\\[nation]([A-Za-z0-9]+( [A-Za-z0-9]+)*)\\[\\/nation] \\(\\[nation]([a-zA-Z0-9]+( [a-zA-z0-9]+)*)\\[\\/nation]\\)\\[\\/td]\\[td]\\[i](.+( .+)+)\\[\\/i]\\[\\/td]\\[td]([A-Za-z0-9]+)\\[\\/td]\\[td]\\[b]([0-9]+(\\/[0-9]+)+)\\[\\/b]\\[\\/td]\\[\\/tr]', 'g');

const fetchDispatch = async () => {
    let cache = await loadFromCache('registry');
    if (Object.keys(cache).length !== 0) {
        const i = input("Senate registry is cached, do you want to use the cached version? If the dispatch was recently updated, select \"n\". (y/n): ", 'n', {});
        if (i.toLowerCase() === 'y') {
            if (cache.timestamp < Date.now() - 259200000) {
                logger.logInfo('Cache is older than three days, refreshing dispatch');
                return await fetchAPI(`https://www.nationstates.net/cgi-bin/api.cgi?q=dispatch;dispatchid=${cache.id}`);
            } else {
                return cache;
            }
        }
    }
    const url = input("Input the Senate registry URL: ", '', {});
    const dispatchid = dispatchRegex.exec(url)[0];
    return await fetchAPI(`https://www.nationstates.net/cgi-bin/api.cgi?q=dispatch;dispatchid=${dispatchid}`);
}

const saveDispatch = async (dispatch) => {
    if (dispatch.timestamp !== undefined) return dispatch;
    dispatch = dispatch["WORLD"]["DISPATCH"];
    const cache = {
      'title': dispatch.TITLE,
      'author': dispatch.AUTHOR,
      'id': dispatch.id,
      'senators': [],
      'timestamp': Date.now()
    };

    //match all of the text with all four regexes
    for (const match of dispatch.TEXT.matchAll(singleRegex)) {
        cache.senators.push({
            'nation': match[1],
            'alias': match[1],
            'senator': match[3],
            'party': match[5],
            'expiration': match[6]
        })
    }

    for (const match of dispatch.TEXT.matchAll(singleExpiredRegex)) {
        cache.senators.push({
            'nation': match[1],
            'alias': match[1],
            'senator': match[3],
            'party': match[5],
            'expiration': match[6]
        })
    }

    for (const match of dispatch.TEXT.matchAll(aliasRegex)) {
        cache.senators.push({
            'nation': match[1],
            'alias': match[3],
            'senator': match[5],
            'party': match[7],
            'expiration': match[8]
        })
    }

    for (const match of dispatch.TEXT.matchAll(aliasExpiredRegex)) {
        cache.senators.push({
            'nation': match[1],
            'alias': match[3],
            'senator': match[5],
            'party': match[7],
            'expiration': match[8]
        })
    }

    logger.logDebug(`Registered ${cache.senators.length} senators`);
    await saveToCache(cache, 'registry');
}

const generateTelegrams = async () => {
    const registry = await loadFromCache('registry');
    const telegram = await loadFromCache('telegram');
    const mode = input('Do you want to send the telegrams manually using generated URLs, or use a telegram API key. NOTE- you will need to ask the Imperial Council for the API key. Manual tends to be faster than API. (auto/manual): ', 'manual', {});
    if (mode.toLowerCase() === 'auto') {
        await automaticTelegrams(registry, telegram);
    } else if (mode.toLowerCase() === 'manual') {
        await manualTelegrams(registry, telegram);
    } else {
        logger.logWarning('Invalid input');
        await generateTelegrams();
    }
}

const automaticTelegrams = async (registry, telegram) => {
    if (!telegram.hasOwnProperty('client')) {
        logger.logWarning('You are missing a telegram client key!');
        const key = input('Enter your telegram client key: ', '', {});
        if (key === '') {
            logger.logError('You need a client key to use automatic telegrams');
            return;
        }
        telegram.client = key;
        await saveToCache(telegram, 'telegram');
    }

    if (!telegram.hasOwnProperty('tgid')) {
        logger.logWarning('You are missing a telegram ID!');
        const key = input('Enter your telegram ID (if you don\'t know what this is, use manual mode instead): ', '', {});
        if (key === '') {
            logger.logError('You need a telegram ID to use automatic telegrams');
            return;
        }
        telegram.tgid = key;
        await saveToCache(telegram, 'telegram');
    }

    if (!telegram.hasOwnProperty('secret')) {
        logger.logWarning('You are missing a telegram template secret key!');
        const key = input('Enter your telegram template secret key (if you don\'t know what this is, use manual mode instead): ', '', {});
        if (key === '') {
            logger.logError('You need a telegram template key to use automatic telegrams');
            return;
        }
        telegram.secret = key;
        await saveToCache(telegram, 'telegram');
    }

    let count = 1;
    for (const senator of registry.senators) {
        logger.logInfo(`Sending telegram ${count} to ${senator.alias}`)
        await fetchAPI(`https://www.nationstates.net/cgi-bin/api.cgi?a=sendTG&client=${telegram.client}&tgid=${telegram.tgid}&key=${telegram.secret}&to=${senator.alias.replaceAll(' ', '_')}`);
        await sleep(31 * 1000);
    }
}

const manualTelegrams = async (registry, telegram) => {
    //check if text exists
    if (!telegram.hasOwnProperty('manual')) {
        logger.logError('You need to write a telegram message in the JSON file at ./cache/telegram.json. A stub has been generated for you, write your message in the "manual" field.');
        await saveToCache({
            manual: 'Replace this text! Useful keycodes: &&SENATOR&& substitutes the senator name. &&NATION&& substitutes the nation name. &&PARTY&& substitutes the party name . &&EXPIRATION&& substitutes the expiration date. \n does a line break'
        }, 'telegram');
        return;
    }

    //generate html
    logger.logDebug('Generating telegram URLs');
    const text = telegram.text.replaceAll(' ', '+');
    let html = `<!DOCTYPE html><html lang="en-us"><head><title>Generated Telegram Page</title></head><body>`;
    for (const senator of registry.senators) {
        html += `<a href="https://www.nationstates.net/page=compose_telegram?tgto=${senator.alias.toLowerCase().replaceAll(' ', '_')}&message=${text.replaceAll('&&SENATOR&&', senator.senator)
            .replaceAll('&&NATION&&', senator.alias)
            .replaceAll('&&PARTY&&', senator.party)
            .replaceAll('&&EXPIRATION&&', senator.expiration)
            .replaceAll('\n', '%0A')}">${senator.alias}</a><br>`
    }
    html += `</body></html>`

    //save html to cache
    await fs.promises.writeFile(`./cache/telegrams.html`, html);
    logger.logInfo('HTML file of telegram links generated at ./cache/telegrams.html');
}

const telegram = async () => {
    try {
        await saveDispatch(await fetchDispatch());
        await generateTelegrams();
    } catch (e) {
        logger.logError('Fatal error');
        logger.logError(e);
    }
}

export default telegram;