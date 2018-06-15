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
      const msg = data.toString()
      if(msg.indexOf('#peer-') !== 0) return
      console.log(msg)
      const parts = msg.replace(/#peer-/g, '').split('^^>')
      this[parts[0]] && this[parts[0]](JSON.parse(parts[1]))
    })

    peer.on('error', () => {
      console.log('peer error')
      removePeer()
    })

    peer.on('end', () => {
      console.log('peer left')
      removePeer()
    })

    const removePeer = () => {
      connectedPeers.slice(connectedPeers.indexOf(this), 1)
      delete connectionTable[this.host]
    }

    this.emit = (event, data) => {
      peer.write(`#peer-${event}^^>${JSON.stringify(data)}`)
    }

    this.connectionTable = (data) => {
      connectionTable = {
        ...connectionTable,
        ...data.connectionTable
      }

      const selfIndex = Object.keys(connectionTable).indexOf(data.selfHost)
      findPeers(selfIndex)
    }
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

function broadcast(event, data){
  connectedPeers.forEach(peer => {
    peer.emit(event, data)
  })
}

const server = net.createServer((peer) => {
  const newClientPeer = new Peer(peer)
  newClientPeer.emit('connectionTable', {
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