#!/usr/bin/env node

const net = require('net')
const prompt = require('prompt')

const port = 1995
const connectedPeers = []
let connectionTable = {}

class Peer {
  constructor(peer, host){
    this.host = host || peer.remoteAddress.replace(/^.*:/, '')
    connectedPeers.push(this)
    connectionTable[this.host] = true

    console.log('peer connected', this.host)

    peer.on('data', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        console.log(msg, this.host)
        if(msg.connectionTable){
          updateConnectionTable(msg.connectionTable)
          const selfIndex = Object.keys(connectionTable).indexOf(msg.selfHost)
          findPeers(selfIndex)
        }
      } catch(err) {
        console.log('Invalid Message Received')
      }
    })

    peer.on('error', () => {
      console.log('peer error', this.host)
      removePeer()
    })

    peer.on('end', () => {
      console.log('peer left', this.host)
      removePeer()
    })

    const removePeer = () => {
      connectedPeers.slice(connectedPeers.indexOf(this), 1)
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

function broadcast(data){
  connectedPeers.forEach(peer => peer.emit(data))
}

const server = net.createServer((peer) => {
  const newClientPeer = new Peer(peer)
  newClientPeer.emit({
    selfHost: newClientPeer.host,
    connectionTable
  })
}).listen(port)

prompt.start()
prompt.get('host', (err, result) => {
  if(err || !result.host) return
  const {host} = result
  const hostPeer = net.connect({host, port})
  new Peer(hostPeer, host)
})