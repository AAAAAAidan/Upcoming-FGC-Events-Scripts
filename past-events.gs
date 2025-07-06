// TODO
// 1. Delete or repurpose this file

function updateTournamentListing() {
  const properties = PropertiesService.getScriptProperties()
  let pageNumber = Number(properties.getProperty("pageNumber"))
  while (++pageNumber < 10) {
    const state = "AZ"
    const tournamentObjects = getTournamentsByPageAndState(pageNumber, state)
    const dataRows = getDataRows(tournamentObjects)
    insertSheetDataRows(dataRows, state)
  }
  properties.setProperty("pageNumber", pageNumber)
}

function getTournamentsByPageAndState(pageNumber, state) {
  // Query the 10 most recent tournaments with data from each event and top 3 standings included
  const tournamentsByState = `
    query TournamentsByState(\$page: Int = 1, \$perPage: Int = 10, \$state: String!) {
      tournaments(query: {
        page: \$page
        perPage: \$perPage
        filter: {
          addrState: \$state
        }
      }) {
        nodes {
          id
          slug
          name
          events {
            id
            slug
            startAt
            name
            numEntrants
            videogame {
              id
              name
            }
            standings(query: {
              perPage: 3,
              page: 1
            }) {
              nodes {
                placement
                entrant {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `
  const formData = {
    "operationName": "TournamentsByState",
    "query": tournamentsByState,
    "variables": JSON.stringify({
      page: pageNumber,
      perPage: 10,
      state: state
    })
  }
  const apiKey = PropertiesService.getScriptProperties().getProperty("apiKey")
  const headers = {
    "Authorization": `Bearer ${apiKey}`
  }
  const options = {
    "method": "POST",
    "headers": headers,
    "payload": formData
  }
  const url = "https://api.start.gg/gql/alpha"
  const response = UrlFetchApp.fetch(url, options)
  const json = JSON.parse(response.getContentText())
  return json.data.tournaments
}

function getDataRows(tournamentObjects) {
  const dataRows = []
  tournamentObjects.nodes.forEach(tournament => {
    const startGgUrl = "https://www.start.gg/"
    const tournamentUrl = startGgUrl + tournament.slug
    console.log(`TOURNAMENT: ${tournament.name} (${tournamentUrl})`)
    if (tournament.events === null) {
      console.log("No listed events")
      return
    }
    tournament.events.forEach(event => {
      const eventUrl = startGgUrl + event.slug
      console.log(`EVENT: ${event.videogame.name}`)
      const eventDataForSheetRow = {
        "date": new Date(event.startAt * 1000),
        "name": `${tournament.name}: ${event.name}`,
        "game": event.videogame.name,
        "url": eventUrl,
        "entrants": event.numEntrants,
        "firstPlace": null,
        "secondPlace": null,
        "thirdPlace": null
      }
      event.standings.nodes.forEach(standing => {
        switch (standing.placement) {
          case 1:
            eventDataForSheetRow.firstPlace = standing.entrant.name
            break;
          case 2:
            eventDataForSheetRow.secondPlace = standing.entrant.name
            break;
          case 3:
            eventDataForSheetRow.thirdPlace = standing.entrant.name
            break;
        }
      })
      dataRows.push(Object.values(eventDataForSheetRow))
    })
  })
  return dataRows
}

function insertSheetDataRows(dataRows, sheetName) {
  const spreadsheet = SpreadsheetApp.openById("1AIMZepfkEIUmTYFgFY4t4wTQSXrP_YvETAB-WAwyCyM")
  const sheet = spreadsheet.getSheetByName(sheetName)
  const rowCount = dataRows.length
  const columnCount = dataRows[0].length
  console.log(`Inserting ${rowCount} rows into sheet "${sheetName}"`)
  sheet.insertRowsBefore(2, rowCount)
  sheet.getRange(2, 1, rowCount, columnCount).setValues(dataRows)
  sheet.setFrozenRows(1)
  sheet.sort(1, false)
}
