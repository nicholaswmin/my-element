import express from 'express'
import { fileURLToPath as path } from 'url'
import { dirname, join } from 'path'

const PORT = process.env.PORT || 3100,
       app = express()

app.use(express.static(join(dirname(path(import.meta.url)), '..')))
app.use(express.static(dirname(path(import.meta.url))))

app.listen(PORT, error => error 
  ? console.error('demo failed:', error) 
  : console.info('demo running:', PORT))
