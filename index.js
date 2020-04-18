const pptr = require('puppeteer');

const {FITBIT_EMAIL, FITBIT_PASSWORD} = process.env;
const START_DATE = process.argv[2];

const DASH_HEART_RATE_DIV_SELECTOR = '#dash > div.tileContainer > div.tile.unflipped.responsive-triple-wide.tripleWideActivity.today';
const NEXT_DATE_BUTTON_SELECTOR = '#dashDateNav > section.block.buttons > a.next:not(.invisible)';
const LOGIN_URL = 'https://accounts.fitbit.com/login?targetUrl=https%3A%2F%2Fwww.fitbit.com%2Flogin%2Ftransferpage%3Fredirect%3Dhttps%253A%252F%252Fwww.fitbit.com&lcl=en_IN';
const DASH_XHR_URL = 'https://www.fitbit.com/ajaxapi';
const FITBIT_DASH_BASE_URL = 'https://www.fitbit.com/';

// Preparing main data object
let metadata;
try {
	metadata = require('./data/meta.json');
} catch (err) {
	metadata = {
		lastUpdated: START_DATE
	}
}

const buildUrl = date => {
	return `${FITBIT_DASH_BASE_URL}/${date}`;
}

const login = async page => {
	await page.goto(LOGIN_URL);
	await page.waitForNavigation({waitUntil: 'networkidle0'});

	await page.type('#ember653', FITBIT_EMAIL);
	await page.type('#ember654', FITBIT_PASSWORD);
	await page.click('#ember694');

	await page.waitForNavigation({waitUntil: 'networkidle0'});
	await page.waitForSelector(DASH_HEART_RATE_DIV_SELECTOR, {visible: true, timeout: 0});
}

const goToDate = async (page, date) => {
	await page.goto(buildUrl(date));
	await page.waitForNavigation({waitUntil: 'networkidle0'});
	await page.waitForSelector(DASH_HEART_RATE_DIV_SELECTOR, {visible: true, timeout: 0});
}

const store = (date, activity) => {

}

const processResponse = async response => {
	const json = await response.json();

	// Checks
	if (response.url() !== DASH_XHR_URL) return;
	if (!Array.isArray(json)) return;
	if (!('dataSets' in json)) return;

	const {activity} = json.dataSets;
	await store(date, activity);
}

const next = async page => {
	await page.waitForSelector(DASH_HEART_RATE_DIV_SELECTOR, {visible: true, timeout: 0});
	const nextButton = await page.$(NEXT_DATE_BUTTON_SELECTOR);

	if (!nextButton) {
		return exit();
	}

	return nextButton.click();
}

const exit = () => process.exit();

const main = async () => {
	const browser = await pptr.launch({headless: false});
	const page = await browser.newPage();
	await page.setViewport({width: 1200, height: 720});

	await login(page);

	// Setup the XHR interceptor to catch activity data
	page.on('response', async response => {
		await processResponse(response); // process the response we received (any response)
		return next(page); // click next date!
	});

	// Navigate to lastUpdated
	const lastUpdated = metadata.lastUpdated;
	await goToDate(lastUpdated);
};

(async () => await main())();
