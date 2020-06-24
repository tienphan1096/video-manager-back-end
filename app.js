require('dotenv').config()

const db = require('./database/database')
const fs = require('fs');
var ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath('/Users/tienphan/Sites/video-manager-back-end/ffmpeg')
ffmpeg.setFfprobePath('/Users/tienphan/Sites/video-manager-back-end/ffprobe')
var bodyParser = require('body-parser');
var cors = require('cors')

const express = require('express');
const connection = require('./database/database');
const app = express()
const port = 3000

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.use(cors())

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

app.post('/addMovie', (req, res, next) => {
  db.beginTransaction(async (err) => {
    try {
      let movieId = await insertMovieToDB(req.body.fileName, req.body.name)
    
      if (req.body.actors) {
        let actors = req.body.actors.split(',')
        await insertMovieCast(movieId, req.body.actors)
      }
      
      generateThumbnail(movieId, req.body.fileName)
  
      res.json({
        result: 'success'
      })
    } catch(err) {
      db.rollback()
      next(err)
    }
  })
})

app.post('/addActor', (req, res, next) => {
  db.query(`INSERT INTO actors(name) VALUES('${req.body.actorName}')`, (err, result) => {
    try {
      if (err) {
        throw new Error(err.sqlMessage)
      }

      if(req.body.movies) {
        const actorId = result.insertId
        let { movies } = req.body
        movies = movies.split(',')
        const toInsert = []
        movies.forEach(movieId => {
          toInsert.push([movieId, actorId])
        });
        db.query('INSERT INTO movieactors(movieId, actorId) VALUES ?', [ toInsert ], (err) => {
          if (err) {
            throw new Error(err.sqlMessage)
          } else {
            res.json({
              result: 'success'
            })
          }
        })
      }
    } catch(e) {
      next(e)
    }
  })

})

app.use(function (err, req, res, next) {
  console.log(err)
  res.status(500).send(err)
})

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))

function insertMovieToDB(fileName, name) {
  return new Promise((resolve, reject) => {
    if (!fileName) {
      reject('Missing file name.')
    }

    db.query(`INSERT INTO movies(filename, name) VALUES('${fileName}', '${name}')`, (err, result) => {
        if (err) {
          reject(err.sqlMessage)
          return
        }
        resolve(result.insertId)
    })
  })
}

function insertMovieCast(movieId, actors) {
  return new Promise((resolve, reject) => {
    if (actors && actors.length > 0) {
      actors = actors.split(',')
      const toInsert = []
      actors.forEach(actorId => {
        toInsert.push([movieId, actorId])
      });
      db.query('INSERT INTO movieactors(movieId, actorId) VALUES ?', [ toInsert ], (err) => {
        if (err) {
          reject(err.sqlMessage)
        } else {
          resolve()
        }
      })
    }
  })
}

function generateThumbnail(movieId, fileName) {
  let timemark = generateRandomNumber(0, 100)
  ffmpeg(`assets/movies/${fileName}`)
    .screenshots({
      timestamps: [timemark],
      filename: `${movieId}.png`,
      folder: 'assets/thumbnails'
    })
}

function generateRandomNumber(min, max) {
  return min + ((max-min) * Math.random())
}