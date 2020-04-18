const pptr = require('puppeteer');
const fse = require('fs-extra');

const {FITBIT_EMAIL, FITBIT_PASSWORD} = process.env;
const START_DATE = process.argv[2];

const DASH_TILE_CONTAINER_SELECTOR = '#dash > div.tileContainer';
const NEXT_DATE_BUTTON_SELECTOR = '#dashDateNav > section.block.buttons > a.next:not(.invisible)';
const LOGIN_URL = 'https://accounts.fitbit.com/login?targetUrl=https%3A%2F%2Fwww.fitbit.com%2Flogin%2Ftransferpage%3Fredirect%3Dhttps%253A%252F%252Fwww.fitbit.com&lcl=en_IN';
const DASH_XHR_URL = 'https://www.fitbit.com/ajaxapi';
const FITBIT_DASH_BASE_URL = 'https://www.fitbit.com';

// Ongoing date variable
let ongoingDate;

// Preparing main data object
let metadata;
try {
	metadata = require('./data/meta.json');
} catch (err) {
	metadata = {
		lastUpdated: START_DATE
	}
}

const buildUrl = date => `${FITBIT_DASH_BASE_URL}/${date}`;

const delay = duration => new Promise(res => setTimeout(res, duration));

const login = async page => {
	await page.goto(LOGIN_URL);
	await page.waitForNavigation({waitUntil: 'networkidle0'});

	await page.type('#ember653', FITBIT_EMAIL);
	await page.type('#ember654', FITBIT_PASSWORD);
	await page.click('#ember694');

	await page.waitForNavigation({waitUntil: 'networkidle0'});
	await page.waitForSelector(DASH_TILE_CONTAINER_SELECTOR, {visible: true, timeout: 0});

	console.info('✔️', 'Logged in');
}

const goToDate = async (page, date) => {
	await page.goto(buildUrl(date));
	await page.waitForNavigation({waitUntil: 'networkidle0'});
	await page.waitForSelector(DASH_TILE_CONTAINER_SELECTOR, {visible: true, timeout: 0});
}

const store = async data => {
	await fse.outputJson(`data/${ongoingDate}.json`, data, {spaces: 2});
}

const deleteKeys = data => data.map(point => {
	const {defaultZone, customZone, ...required} = point;
	return required;
});

const processResponse = async response => {
	// Checks
	if (response.url() !== DASH_XHR_URL) return false;

	let json;
	try {
		json = await response.json();
	} catch {
		return false;
	}

	if (!Array.isArray(json)) return false;
	if (json.length === 0) return false;
	if (!('dataSets' in json[0])) return false;

	const {dataPoints} = json[0].dataSets.activity;
	await store(deleteKeys(dataPoints));
	return true;
}

const next = async page => {
	await page.waitForSelector(DASH_TILE_CONTAINER_SELECTOR, {visible: true, timeout: 0});
	const nextButton = await page.$(NEXT_DATE_BUTTON_SELECTOR);

	if (!nextButton) {
		return exit();
	}

	await delay(1000); // wait for a second to prevent overflooding of requests
	return nextButton.click();
}

// Exit function to graciously exit the script
const exit = async () => {
	// Write lastUpdated to metadata file
	metadata.lastUpdated = ongoingDate;
	await fse.outputJson('data/meta.json', metadata);

	// Exit script
	process.exit();
}

const main = async () => {
	const browser = await pptr.launch({headless: true});
	const page = await browser.newPage();
	await page.setViewport({width: 1200, height: 720});

	// Login to the dashboard
	await login(page);

	// Setup the XHR interceptor to catch activity data
	page.on('response', async response => {
		// process the response we received (any response)
		if (await processResponse(response)) {
			console.info('✔️', 'Date:', ongoingDate);

			// Hacky way of ensuring today's date doesn't make ongoingDate ''
			const bufferDate = new URL(page.url()).pathname.slice(1);
			ongoingDate = bufferDate.length > 0 ? bufferDate : ongoingDate;

			return next(page); // click next date!
		}
	});

	// Navigate to lastUpdated
	ongoingDate = metadata.lastUpdated;
	await goToDate(page, ongoingDate);
};

(async () => await main())();
