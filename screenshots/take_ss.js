const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ 
      headless: 'new',
      executablePath: 'C:\\Users\\melih\\.cache\\puppeteer\\chrome\\win64-148.0.7778.167\\chrome-win64\\chrome.exe'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 2048, height: 2732, deviceScaleFactor: 1 });
  
  const routes = [
      { name: '1_dashboard', url: 'http://localhost:8081/' },
      { name: '2_focus', url: 'http://localhost:8081/focus' },
      { name: '3_cockpit', url: 'http://localhost:8081/cockpit' },
      { name: '4_tasks', url: 'http://localhost:8081/tasks' },
      { name: '5_modlar', url: 'http://localhost:8081/modlar' },
      { name: '6_profile', url: 'http://localhost:8081/profile' }
  ];
  
  const outDir = 'd:/Tazq-App/screenshots/ipad_native';
  if (!fs.existsSync(outDir)) { fs.mkdirSync(outDir); }
  
  for (const route of routes) {
      await page.goto(route.url, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({ path: outDir + '/' + route.name + '.jpg', type: 'jpeg', quality: 95 });
      console.log('Took native screenshot for ' + route.name);
  }
  
  await browser.close();
})();
