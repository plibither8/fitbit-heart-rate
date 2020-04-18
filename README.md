# Fitbit Heart Rate Data

> 💓 Collect lifetime heart rate data on Fitbit using Puppeteer.

![Build Status](https://github.com/plibither8/fitbit-heart-rate/workflows/Heart%20Rate%20Bot/badge.svg)

A small script that automates the process of collecting heart rate data from Fitbit. Data for each day is stored in a separate JSON file in `data/YYYY/MM/DD.json`. The data has a granularity of 5 minutes.

Alternately, one can export their entire Fitbit data from their account settings, but that contains way more (granular) data than I require, and it cannot be automated.

I have also set up a [cron-based GitHub Action workflow](https://github.com/plibither8/fitbit-heart-rate/actions) that fetches new heart rate data every day and stores it in a private repository.

## Usage

* Clone this repo.
* Create a `data/` directory to store heart rate data files: `mkdir data`
* Set `FITBIT_EMAIL` and `FITBIT_PASSWORD` environment variables.
* Install npm dependencies: `npm install`
* Run the script by providing a start date (YYYY/MM/DD format) as an argument (required for the first run): `node index <YYYY/MM/DD>`

#### NB:

* Start date is the date you first started recording your data (started using your Fitbit), or any other date of your choice.
* The start date argrument is not required on subsequent runs (`lastUpdated` is stored in `data/meta.json`).

## License

[MIT](LICENSE)
