const pptr = require('puppeteer');
const fse = require('fs-extra');

const {FITBIT_EMAIL, FITBIT_PASSWORD, CI = false} = process.env;
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
	console.info('…', 'Login process started');

	await page.goto(LOGIN_URL);
	await page.waitForNavigation({waitUntil: 'networkidle0'});
	console.info('✔️ ', 'Login page loaded');

	await page.type('#ember653', FITBIT_EMAIL);
	await page.type('#ember654', FITBIT_PASSWORD);
	await page.click('#ember694');
	console.info('✔️ ', 'Login credentials submitted');

	console.info('…', 'Waiting for dash to load');
	await page.waitForNavigation({waitUntil: 'networkidle0'});
	await page.waitForSelector(DASH_TILE_CONTAINER_SELECTOR, {visible: true, timeout: 0});

	console.info('✔️ ', 'Logged in!');
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

const processResponse = async (response, page) => {
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

	ongoingDate = new URL(page.url()).pathname.slice(1);

	if (ongoingDate === '') {
		next(page);
		return false;
	}

	metadata.lastUpdated = ongoingDate;

	const {dataPoints} = json[0].dataSets.activity;
	await store(deleteKeys(dataPoints));
	return true;
}

const next = async page => {
	await page.waitForSelector(DASH_TILE_CONTAINER_SELECTOR, {visible: true, timeout: 0});
	const nextButton = await page.$(NEXT_DATE_BUTTON_SELECTOR);

	if (!nextButton) {
		metadata.lastChecked = new Date().getTime();
		return exit();
	}

	await delay(1000); // wait for a second to prevent overflooding of requests
	nextButton.click();
}

// Exit function to graciously exit the script
const exit = async () => {
	// Write lastUpdated to metadata file
	await fse.outputJson('data/meta.json', metadata);

	// Exit script
	process.exit();
}

const main = async () => {
	const finalDate = new Date(
			new Date().getTime() - 24*60*60*1000 // yesterday
		)
		.toLocaleString('sv')
		.split(' ')[0]
		.replace(/-/g, '/');

	const browser = await pptr.launch({
		headless: true,
		executablePath: 'google-chrome-stable'
	});

	const page = await browser.newPage();
	await page.setViewport({width: 1200, height: 720});

	// Login to the dashboard
	await login(page);

	// Setup the XHR interceptor to catch activity data
	page.on('response', async response => {
		// process the response we received (any response)
		if (await processResponse(response, page)) {
			console.info('✔️ ', 'Date:', ongoingDate);

			// If the current date matches yesterday's date
			if (ongoingDate === finalDate) {
				return exit();
			}

			return next(page); // click next date!
		}
	});

	// Navigate to lastUpdated
	ongoingDate = metadata.lastUpdated;
	await goToDate(page, ongoingDate);
};

(async () => await main())();
