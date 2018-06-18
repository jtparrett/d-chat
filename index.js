#!/usr/bin/env node

const net = require('net')
const uuid = require('uuid/v1')
const colors = require('colors')
const readline = require('readline')

const port = 1995
const messages = {}
const connectedPeers = []
let connectionTable = {}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

class Peer {
  constructor(peer, host){
    this.host = host || peer.remoteAddress.replace(/^.*:/, '')
    connectedPeers.push(this)
    connectionTable[this.host] = true

    console.log('new peer'.green, this.host)

    peer.on('data', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        if(msg.connectionTable){
          updateConnectionTable(msg.connectionTable)
          const selfIndex = Object.keys(connectionTable).indexOf(msg.selfHost)
          findPeers(selfIndex)
        }

        if(msg.message && !messages[msg.id]){
          console.log(msg.message)
          messages[msg.id] = msg.message
          broadcast(msg, peer)
        }
      } catch(err) {
        console.log('Invalid Message Received'.red)
      }
    })

    peer.on('error', () => {
      console.log('peer error'.red, this.host)
      removePeer()
    })

    peer.on('end', () => {
      console.log('peer left'.red, this.host)
      removePeer()
    })

    const removePeer = () => {
      connectedPeers.splice(connectedPeers.indexOf(this), 1)
      delete connectionTable[this.host]
    }

    this.emit = (data) => {
      peer.write(JSON.stringify(data))
    }
  }
}

function updateConnectionTable(update){
  connectionTable = {
    ...connectionTable,
    ...update
  }
}

function findPeers(startPeerIndex){
  let searchIndex = 1
  const keys = Object.keys(connectionTable)
  while(searchIndex < keys.length){
    const index = (startPeerIndex + searchIndex) % keys.length
    const host = keys[index]
    const preConnected = connectedPeers.some(p => p.host.includes(host))
    if(host && !preConnected){
      const newHostPeer = net.connect({host, port})
      new Peer(newHostPeer, host)
    }
    searchIndex *= 2
  }
}

function broadcast(data, sender){
  connectedPeers.forEach(peer => {
    if(peer === sender) return
    peer.emit(data)
  })
}

function promptMessage(){
  rl.question('Message: ', (message) => {
    if(!message) return
    const id = uuid()
    messages[id] = message
    broadcast({id, message})
    promptMessage()
  })
}

const server = net.createServer((peer) => {
  const newClientPeer = new Peer(peer)
  newClientPeer.emit({
    selfHost: newClientPeer.host,
    connectionTable
  })
}).listen(port)

rl.question('Enter a Host Peer i.p: ', (host) => {
  promptMessage()
  if(!host) return
  const hostPeer = net.connect({host, port})
  new Peer(hostPeer, host)
})