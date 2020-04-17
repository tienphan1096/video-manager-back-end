require('dotenv').config()

const db = require('./database/database')

const fs = require('fs')

const express = require('express')
const app = express()
const port = 3000

app.get('/test', (req, res) => res.send('Hello World!'))

app.get('/scan', (req, res) => {

  const files = fs.readdirSync('./assets/movies')
    
  db.query('SELECT * FROM movies', (err, movies, fields) => {
    const toReturn = {
      newFiles: [],
      missing: []
    }
    files.forEach(fileName => {
      let match = movies.find(movie => movie.filename === fileName)
      if (!match) {
        toReturn.newFiles.push(fileName)
      }
    });

    movies.forEach(movie => {
      let match = files.find(file => file === movie.filename)
      if (!match) {
        toReturn.missing.push(movie)
      }
    })
    res.json(toReturn)
  })
})

app.get('/getVideoFile/:id', (req, res) => {
  db.query(`SELECT filename FROM movies WHERE id = ${req.params.id}`, (err, results, fields) => {
    const fileName = results[0].filename
    res.sendFile(`${process.env.assets_dir}/movies/${fileName}`)
  })
})

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))