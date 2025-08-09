// TODO
// 1. Split sheets by tournament location (US state and then country)

/**
 * Update and/or add upcoming events in FGC Event Listing sheets.
 */
function updateEventListing() {
  let pageNumber = 0
  // Pages are expected to return up to 10 tournaments
  while (++pageNumber) {
    const state = "AZ"
    const tournaments = getTournaments(pageNumber, state)
    const rows = getRowValues(tournaments)
    updateSheetData(rows, state)
    // If there are no results left, end the loop
    if (rows.length < 10) {
      break
    }
  }
}

/**
 * Get a 10 result page of upcoming tournaments in the given state.
 * @param {Number} pageNumber - A page number.
 * @param {String} state - A two letter state abbreviation.
 * @return {Array[Object]} An array of tournaments. Refer to start.gg's GraphQL schema.
 */
function getTournaments(pageNumber, state) {
  const tournamentsByStateAndStartTimeQuery = `
    query tournamentsByStateAndStartTime(\$page: Int = 1, \$perPage: Int = 10, \$state: String, \$startAt: Timestamp!) {
      tournaments(query: {
        page: \$page
        perPage: \$perPage
        filter: {
          addrState: \$state
          afterDate: \$startAt
        }
      }) {
        nodes {
          id
          slug
          name
          startAt
          venueAddress
          events {
            id
            videogame {
              id
              name
            }
          }
        }
      }
    }
  `
  // Convert the start time from a JavaScript date to a Unix timestamp
  const queryVariables = {
    page: pageNumber,
    perPage: 10,
    state: state,
    startAt: Math.floor(new Date().getTime() / 1000),
  }
  const formData = {
    "operationName": "tournamentsByStateAndStartTime",
    "query": tournamentsByStateAndStartTimeQuery,
    "variables": JSON.stringify(queryVariables),
  }
  const apiKey = PropertiesService.getScriptProperties().getProperty("apiKey")
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
  }
  const options = {
    "method": "POST",
    "headers": headers,
    "payload": formData,
  }
  const url = "https://api.start.gg/gql/alpha"
  const response = UrlFetchApp.fetch(url, options)
  const json = JSON.parse(response.getContentText())
  console.log(`${json.data.tournaments.nodes.length} upcoming tournaments found`)
  return json.data.tournaments.nodes
}

/**
 * Convert an array of tournaments from the start.gg API to an array of rows for the Google Sheets API.
 * @param {Array[Object]} tournaments - An array of tournaments. Refer to start.gg's GraphQL schema.
 * @return {Array[Array[Object]]} An array of row and column values.
 */
function getRowValues(tournaments) {
  const rows = []
  tournaments.forEach(tournament => {
    const tournamentUrl = "https://www.start.gg/" + tournament.slug + "/details"
    console.log(`Tournament: ${tournament.name} (${tournamentUrl})`)
    // Ignore any tournaments that don't have any events
    if (tournament.events === null) {
      console.log("No listed events")
      return
    }
    // Convert the start time from a Unix timestamp to a JavaScript date
    const startAt = new Date(tournament.startAt * 1000)
    // Create a forward slash separated list of games in the events, using a set to exclude duplicates
    const gamesArray = tournament.events.map(event => event.videogame.name)
    const gamesString = Array.from(new Set(gamesArray)).join(" / ")
    rows.push([startAt, tournament.name, tournamentUrl, tournament.venueAddress, gamesString])
  })
  return rows
}

/**
 * Update or insert rows on the given sheet.
 * @param {Array[Array[Object]]} rows - An array of row and column values.
 * @param {String} sheetName - The name of the sheet to update.
 */
function updateSheetData(rows, sheetName) {
  const spreadsheet = SpreadsheetApp.openById("1AIMZepfkEIUmTYFgFY4t4wTQSXrP_YvETAB-WAwyCyM")
  const sheet = spreadsheet.getSheetByName(sheetName)
  console.log(`Updating/inserting ${rows.length} rows in sheet "${sheetName}"`)
  rows.forEach(columns => {
    const existingRow = sheet.createTextFinder(columns[2]).findNext()
    // If a row for this tournament has already been created, update that row, else insert a new row
    if (existingRow) {
      sheet.getRange(existingRow.getRowIndex(), 1, 1, columns.length).setValues([columns])
    } else {
      sheet.insertRowsBefore(2, 1)
      sheet.getRange(2, 1, 1, columns.length).setValues([columns])
    }
  })
  // Freeze the header row and sort the sheet by date ascending
  sheet.setFrozenRows(1)
  sheet.sort(1)
}
