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

app.use(express.static('public'))

app.get('/test', (req, res) => res.send('Hello World!'))

app.get('/movies', (req, res) => {
  db.query('SELECT * FROM movies', (err, movies, fields) => {
    let toReturn = movies.map(movie => {
      return {
        filename: movie.filename,
        name: movie.name,
        thumbnail: `/assets/thumbnails/movies/${movie.id}.png`
      }
    })  
    res.json(toReturn)
  })
})

app.get('/scan', (req, res) => {

  const files = readdirSyncIgnoreHiddenFiles('./public/assets/movies')
    
  db.query('SELECT * FROM movies', (err, movies, fields) => {
    const toReturn = {
      newFiles: [],
      missing: []
    }
    files.forEach(fileName => {
      let match = movies.find(movie => movie.filename === fileName)
      if (!match) {
        toReturn.newFiles.push({
          fileName,
          thumbnail: `/assets/thumbnails/temp/${getFileNameWithoutExtension(fileName)}.png`
        })
      }
    });

    movies.forEach(movie => {
      let match = files.find(file => file === movie.filename)
      if (!match) {
        toReturn.missing.push(movie)
      }
    })

    generateTempThumbnails(toReturn.newFiles)

    res.json(toReturn)
  })
})

app.get('/getVideoFile/:id', (req, res) => {
  db.query(`SELECT filename FROM movies WHERE id = ${req.params.id}`, (err, results, fields) => {
    const fileName = results[0].filename
    res.sendFile(`${process.env.assets_dir}/movies/${fileName}`)
  })
})

app.get('/actors', (req, res) => {
  db.query(`SELECT * FROM actors`, (err, results, fields) => {
    res.json(results)
  })
})

app.post('/movie', (req, res, next) => {
  db.beginTransaction(async (err) => {
    try {
      let movieId = await insertMovieToDB(req.body.fileName, req.body.name)
    
      if (req.body.actors) {
        let actors = req.body.actors.split(',')
        await insertMovieCast(movieId, req.body.actors)
      }
      
      fs.renameSync(`public/assets/thumbnails/temp/${getFileNameWithoutExtension(req.body.fileName)}.png`, `public/assets/thumbnails/movies/${movieId}.png`)
  
      res.json({
        result: 'success'
      })

      db.commit((err) => {
        if (err) {
          throw err
        }
      })
    } catch(err) {
      db.rollback()
      next(err)
    }
  })
})

app.post('/actor', (req, res, next) => {
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
      } else {
        res.json({
          result: 'success'
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

function generateThumbnail(moviePath, thumbnailFolder, thumbnailFileName) {
  let timemark = generateRandomNumber(0, 100)
  ffmpeg(moviePath)
    .screenshots({
      timestamps: [timemark],
      filename: `${thumbnailFileName}.png`,
      folder: thumbnailFolder
    })
}

function generateRandomNumber(min, max) {
  return min + ((max-min) * Math.random())
}

function generateTempThumbnails(videos) {
  let existingThumbnails = readdirSyncIgnoreHiddenFiles('./public/assets/thumbnails/temp')
  existingThumbnails = existingThumbnails.map(name => getFileNameWithoutExtension(name))
  videos.forEach(video => {
    let videoFileNameWithoutExtension = getFileNameWithoutExtension(video.fileName)
    if (!existingThumbnails.includes(videoFileNameWithoutExtension)) {
      generateThumbnail(
        `public/assets/movies/${video.fileName}`,
        'public/assets/thumbnails/temp',
        videoFileNameWithoutExtension
      )
    }
  })
}

function getFileNameWithoutExtension(name) {
  return name.slice(0, name.lastIndexOf('.'))
}

function readdirSyncIgnoreHiddenFiles(folder) {
  let toReturn = fs.readdirSync(folder)
  return toReturn.filter(item => !(/(^|\/)\.[^\/\.]/g).test(item))
}