import path from 'path';
import fs from 'fs';
import axios from 'axios';
import puppeteer from 'puppeteer';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { fileURLToPath } from 'url';
export function createTgDataModule({
  pathToLogClaim,
  pathToLocalStorage,
  pathToLogProxy,
  pathToAccount,
  accounts,
  userAgents
}) {
  let FaileGetTgdata = [];
  let browsers = new Set();
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  function writeTgdata(accID, tg_login) {
    const accountIndex = accounts.findIndex(account => account[0] === accID);
    if (accountIndex !== -1) {
      accounts[accountIndex][10] = tg_login;
      const updatedData = accounts.map(account => account.join(',')).join('\n');
      fs.writeFileSync(pathToAccount, updatedData);
    }
  }
  async function checkProxy(proxy) {
    const proxyUrl = 'http://' + proxy;
    const proxyAgent = new HttpsProxyAgent(proxyUrl);
    try {
      const response = await axios.get('https://api.ipify.org?format=json', {
        httpsAgent: proxyAgent
      });
      if (response.status === 200) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }
  function getStartParam(encodedString) {
    // Decode the URL-encoded string
    const decodedString = decodeURIComponent(encodedString);
    // Split the string into key-value pairs
    const pairs = decodedString.split('&');
    // Find the pair that starts with 'start_param='
    const startParamPair = pairs.find(pair => pair.startsWith('start_param='));
    if (startParamPair) {
      // Split the pair and return the value
      const startParam = startParamPair.split('=')[1];
      return startParam;
    }
    // Return an empty string if start_param is not found
    return null;
  }
  function GetTime() {
    const currentDate = new Date();
    const day = currentDate.getDate();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    const hours = currentDate.getHours();
    const minutes = currentDate.getMinutes();
    const formatNumber = (num) => (num < 10 ? '0' + num : num);
    const timestamp = `${formatNumber(day)}/${formatNumber(month)}/${year} ${formatNumber(hours)}:${formatNumber(minutes)}`;
    return timestamp;
  }
  async function GetTgData(accID, tg_login, Proxy) {
    return new Promise(async (resolve) => {
      if (FaileGetTgdata.includes(accID)) {
        FaileGetTgdata = FaileGetTgdata.filter(item => item !== accID);
      }
      const Time = GetTime();
      const randomAgent = userAgents.Chrome[Math.floor(Math.random() * userAgents.Chrome.length)];
      let isProxyWorking = false;
      if (Proxy && Proxy !== '' && Proxy !== undefined && Proxy !== null) {
        isProxyWorking = await checkProxy(Proxy);
      }
      if (isProxyWorking || Proxy === '' || Proxy === undefined || Proxy === null) {
        try {
          let browser = null;
          let page = null;
          if (Proxy && Proxy !== '' && Proxy !== undefined && Proxy !== null) {
            const [credentials, address] = Proxy.split('@');
            const [username, password] = credentials.split(':');
            browser = await puppeteer.launch({ headless: true, defaultViewport: null, args: [`--proxy-server=http://${address}`] });
            browsers.add(browser);
            page = await browser.newPage();
            await page.authenticate({ username: username, password: password });
          } else {
            browser = await puppeteer.launch({ headless: true, defaultViewport: null });
            browsers.add(browser);
            page = await browser.newPage();
          }
          //await page.setUserAgent(randomAgent);
          try {
            const localStoragePath = path.join(pathToLocalStorage, `${accID}.json`);
            const localStorageData = JSON.parse(fs.readFileSync(localStoragePath, 'utf8'));
            await page.evaluateOnNewDocument((data) => {
              for (let key in data) {
                localStorage.setItem(key, data[key]);
              }
            }, localStorageData);
            const refcode = getStartParam(tg_login);
            await page.goto(`https://web.telegram.org/k/#?tgaddr=tg%3A%2F%2Fresolve%3Fdomain%3Dnotpixel%26appname%3Dapp%26startapp%3D${refcode}`, { waitUntil: 'networkidle2' });
            await sleep(6000);
            await page.waitForSelector('button.popup-button.btn.primary.rp', { timeout: 30000 });
            const LaunchApp = await page.$('button.popup-button.btn.primary.rp');
            await LaunchApp.click();
            await page.waitForSelector('iframe.payment-verification', { timeout: 30000 });
            const iframeElement = await page.$('iframe.payment-verification');
            const iframeSrc = await page.evaluate(iframe => iframe.src, iframeElement);
            if (iframeSrc && iframeSrc.includes('tgWebAppData=')) {
              let url = new URL(iframeSrc);
              let params = new URLSearchParams(url.hash.slice(1));
              let tgWebAppData = params.get('tgWebAppData');
              if (tgWebAppData) {
                let decodedData = decodeURIComponent(decodeURIComponent(tgWebAppData));
                let tgParams = new URLSearchParams(decodedData);
                let newParams = [];
                tgParams.forEach((value, key) => {
                  if (value && value !== 'null') {
                    newParams.push(`${key}=${encodeURIComponent(value)}`);
                  }
                });
                let newSrc = newParams.join('&');
                writeTgdata(accID, newSrc);
              }
            }
            await sleep(8000);
            await browser.close();
            resolve({ success: true });
          }
          catch (error) {
            console.error(` Lỗi quá trình lấy TgData ${Time} ${accID}: ${error}` + '\n' + '-'.repeat(50));
            fs.appendFileSync(pathToLogClaim, ` Lỗi quá trình lấy TgData ${Time} ${accID}: ${error}\n`);
            await browser.close();
            FaileGetTgdata.push(accID);
            resolve({ success: false, error });
          }
        }
        catch (error) {
          console.error(`Lỗi GetTgData ${Time} ${accID}: ${error}`);
          fs.appendFileSync(pathToLogClaim, `Lỗi GetTgData ${Time} ${accID}: ${error}\n`);
          FaileGetTgdata.push(accID);
          resolve({ success: false, error });
        }
      } else {
        console.error(`${Time} ${accID}: Lỗi Proxy ${Proxy}` + '\n' + '-'.repeat(50));
        fs.appendFileSync(pathToLogProxy, `${Time} lỗi Proxy ${Proxy}\n`);
        FaileGetTgdata.push(accID);
        resolve({ success: false, error: 'Proxy error' });
      }
    });
  }
  function getFailedTgData() {
    return [...FaileGetTgdata];
  }
  function clearFailedTgData() {
    FaileGetTgdata = [];
  }
  return {
    GetTgData,
    getFailedTgData,
    clearFailedTgData
  };
}