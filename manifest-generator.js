'use strict'

////////////////////
//  CONFIG        //
////////////////////

const forceUnixLineEndings = true //force \n instead of \r\n (default: true)

const onlyHighestDefVer = false // only greatest def version added to manifest (default: false)

const addAutoUpdateDisableBool = true // add ("disableAutoUpdate": false) to module.json if missing (default: true)

const addFolderNameAsName = true // add ("name": <folder name>) to module.json if missing (default: true)

const addAuthorName = "" // add ("author": <addAuthorName>) to module.json if missing (default: "")

const addDescription = "Description goes here." // add ("description": <addDescription>) to module.json if missing (default: "Description goes here.")

const addServers = [""] // add ("servers": <addServers>) to module.json if missing (default: [""])

const addSupportUrl = "" // add ("supportURL": <addSupportURL>) to module.json if missing (default: "")

const addCategory = "" // add ("category": <addCategory>) to module.json if missing (default: "")

////////////////////
//  LISTS         //
////////////////////

// ignore these files for making manifest
const IGNORED_FILES = [
    'manifest.json',
    'manifest-generator.js',
    'manifest-generator.bat',
    'manifest-generator.exe',
    'node.exe'
]

// ignore files/folders which start with these characters: i.e. ".git" or "_old"
const IGNORED_CHARACTERS = [
    '.',
    '_'
]

// filetypes to force unix line ending if enabled
const FORCE_UNIX_FILE_TYPES = [
    '.txt',
    '.text',
    '.js',
    '.json',
    '.jsn',
    '.xml',
    '.md',
    '.htm',
    '.html',
    '.css',
    '.csv',
    '.php',
    '.cfg',
    '.ini',
    '.list',
    '.lst'
]

////////////////////
//  CODE          //
////////////////////

const crypto = require('crypto'),
    fs = require('fs'),
	path = require('path')

// set directory to launch argument or local directory
let directory = __dirname
if (process.argv[2]) {
    directory = process.argv[2]
    // check if valid directory
    try {
        fs.readdirSync(directory, 'utf8')
    }
    catch (err) {
        console.log(`"${directory}" is not a valid folder.`)
        return
    }
}

// read existing module.json
let modulejson
try {
    modulejson = require(path.join(directory, 'module.json'))
}
catch (error) {
    modulejson = {}
}
if (addAutoUpdateDisableBool && modulejson.disableAutoUpdate === undefined) {
    modulejson.disableAutoUpdate = false
}
if (addFolderNameAsName && modulejson.name === undefined) {
    modulejson.name = path.basename(directory)
}
if (addAuthorName && modulejson.author === undefined) {
    modulejson.author = addAuthorName
}
if (addDescription && modulejson.description === undefined) {
    modulejson.description = addDescription
}
if (addServers && addServers[0] && modulejson.servers === undefined) {
    modulejson.servers = addServers
}
if (addSupportUrl && modulejson.supportUrl === undefined) {
    modulejson.supportUrl = addSupportUrl
}
if (addCategory && modulejson.category === undefined) {
    modulejson.category = addCategory
}
fs.writeFileSync(path.join(directory, 'module.json'), jsonify(modulejson), 'utf8')

// read existing manifest.json
let manifest
try {
    // sanitize input
    manifest = require(path.join(directory, 'manifest.json'))
    if (manifest && typeof manifest === 'object') {
        if (!manifest.files) manifest.files = {}
    }
    else {
        manifest = {
            files: {}
        }
    }
}
catch (error) {
    // make new manifest
    manifest = {
        files: {}
    }
}

// delete removed file entries
let checking = 0
for (let entry of Object.keys(manifest.files)) {
    // check if file exists
    checking  += 1
    fs.access(path.join(directory, entry), fs.constants.F_OK, (err) => {
        checking -= 1
        if (err) delete manifest.files[entry]
        checkProg()
        return
    })
}

let reading = 0
getFiles()

// get all files in folder and subfolder
function getFiles(relativePath = '', files) {
    let dir = path.join(directory, relativePath)
    if (!files) files = fs.readdirSync(dir, 'utf8')
    for (let file of files) {
        // if not ignored file or begins with ignored character
        if (!IGNORED_FILES.includes(file) && !IGNORED_CHARACTERS.includes(file[0])) {
            reading += 1
            fs.readdir(path.join(dir, file), 'utf8', (err, moreFiles) => {
                if (moreFiles) {
                    getFiles(path.join(relativePath, file), moreFiles)
                }
                else {
                    getHash(path.join(relativePath, file))
                }
                reading -= 1
                checkProg()
            })
        }
    }
}

// get sha256 hash
function getHash(file, type = 'sha256') {
    file = file.replace(/\\/g, '/')
    // force unix line endings
    if (forceUnixLineEndings) forceUnix(file)
    if (manifest.files[file] && typeof manifest.files[file] === 'object') {
        manifest.files[file].hash = crypto.createHash(type).update(fs.readFileSync(path.join(directory, file))).digest('hex')
    }
    else {
        manifest.files[file] = crypto.createHash(type).update(fs.readFileSync(path.join(directory, file))).digest('hex')
    }
}

// force unix line endings
function forceUnix(file) {
    // check if read and writable
    for (let type of FORCE_UNIX_FILE_TYPES) {
        if (file.slice(-6).includes(type)) {
            try {
                let data = fs.readFileSync(path.join(directory, file), 'utf8')
                data = data.replace(/\r\n/g, '\n')
                fs.writeFileSync(path.join(directory, file), data, 'utf8')
            }
            catch (err) {
                //console.log(err)
                console.log('Cannot edit protected file: ' + file)
            }
            return
        }
    }
}

// alphabetize object keys
function alphabetizeObject(obj) {
    let keys = Object.keys(obj)
    keys.sort()
    let newObj = {}
    for (let key of keys) {
        newObj[key] = obj[key]
    }
    return newObj
}

// JSON.stringify but make lists single line
function jsonify(obj) {
    obj = JSON.stringify(obj, null, '    ')
    let lists = obj.match(/\[[^]+?\].*/igm)
    if (lists) for (let list of lists) {
        obj = obj.substring(0,obj.indexOf(list)) + list.replace(/[ \n\t]*/igm, '') + obj.substring(obj.indexOf(list) + list.length)
    }
    return obj
}

// check if process completed
function checkProg() {
    if (reading === 0 && checking === 0) {
        manifest.files = alphabetizeObject(manifest.files)
        if (manifest.defs) manifest.defs = alphabetizeObject(manifest.defs)
        fs.writeFileSync(path.join(directory, 'manifest.json'), jsonify(manifest), 'utf8')
        console.log('"manifest.json" generation complete.')
    }
}