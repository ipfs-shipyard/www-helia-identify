import { multiaddr } from '@multiformats/multiaddr'
import { peerIdFromString } from '@libp2p/peer-id'
import { createHelia } from 'helia'
import { base58btc } from 'multiformats/bases/base58'
import { bootstrap } from '@libp2p/bootstrap'


const App = async () => {
  const DOM = {
    input: () => document.getElementById('input'),
    identifyBtn: () => document.getElementById('identify-button'),
    output: () => document.getElementById('output'),
    terminal: () => document.getElementById('terminal'),
    peerCount: () => document.getElementById('node-peer-count')
  }

  const COLORS = {
    active: '#357edd',
    success: '#0cb892',
    error: '#ea5037'
  }

  const scrollToBottom = () => {
    const terminal = DOM.terminal()
    terminal.scroll({ top: terminal.scrollHeight, behavior: 'smooth' })
  }

  const clearStatus = () => {
    DOM.output().innerHTML = ''
  }

  const showStatus = (text, bg, id = null) => {
    const log = DOM.output()

    const line = document.createElement('p')
    line.innerHTML = text
    line.style.color = bg

    if (id) {
      line.id = id
    }

    log.appendChild(line)

    scrollToBottom(log)
  }

  const runIdentify = async (peerIdOrMultiaddr) => {
    clearStatus()

    const signal = AbortSignal.timeout(10000)
    let multiaddrs

    if (peerIdOrMultiaddr.startsWith('/')) {
      multiaddrs = multiaddr(peerIdOrMultiaddr)
    } else {
      showStatus(`Searching for peer ${peerIdOrMultiaddr}...`)
      const peerId = peerIdFromString(peerIdOrMultiaddr)
      const peer = await helia.libp2p.peerRouting.findPeer(peerId, {
        signal,
        onProgress: (evt) => {
          console.info(evt.type, evt.detail)

          if (evt.type === 'kad-dht:query:dial-peer') {
            showStatus(`${evt.type} ${evt.detail.peer}`)
          } else if (evt.type === 'kad-dht:query:send-query') {
            showStatus(`${evt.type} To: ${evt.detail.to} Query: ${evt.detail.messageName}`)
          } else if (evt.type === 'kad-dht:query:query-error') {
            showStatus(`${evt.type} To: ${evt.detail.from} ${evt.detail.error.code} ${evt.detail.error.message}`)
          } else {
            showStatus(`${evt.type}`)
          }
        }
      })

      // multiaddrs need peer ids
      multiaddrs = peer.multiaddrs.map(ma => {
        if (ma.getPeerId() == null) {
          return ma.encapsulate(`/p2p/${peerId}`)
        }

        return ma
      })
    }

    clearStatus()
    showStatus('Connecting to ' + peerIdOrMultiaddr)

    const connection = await helia.libp2p.dial(multiaddrs)

    clearStatus()
    showStatus('Connected, running identify')

    const response = await helia.libp2p.services.identify.identify(connection, {
      signal
    })

    const data = {
      peerId: response.peerId.toString(),
      agentVersion: response.agentVersion,
      protocolVersion: response.protocolVersion,
      observedAddr: response.observedAddr,
      publicKey: base58btc.encode(response.publicKey),
      listenAddrs: response.listenAddrs.map(ma => ma.toString()),
      protocols: response.protocols
    }

    if (response.signedPeerRecord != null) {
      data.signedPeerRecord = {
        seq: `${response.signedPeerRecord.seq}n`,
        addresses: response.signedPeerRecord.addresses.map(ma => ma.toString())
      }
    }

    clearStatus()
    showStatus(`<pre>${JSON.stringify(data, null, 2)}</pre>`, COLORS.success)
  }

  // Event listeners
  DOM.identifyBtn().onclick = async (e) => {
    e.preventDefault()

    const value = DOM.input().value ?? ''
    let peerId = `${value}`.trim()

    if (!peerId) {
      showStatus(`Invalid PeerId or Multiaddr`, COLORS.error)
      return
    }

    try {
      await runIdentify(peerId)
    } catch (err) {
      console.error('Error running identify', err)
      showStatus(`${err}`, COLORS.error)
    }
  }

  showStatus('Creating Helia node')

  const helia = await createHelia({
    libp2p: {
      peerDiscovery: [
        bootstrap({
          list: [
            '/dns4/va1.bootstrap.libp2p.io/tcp/443/wss/p2p/12D3KooWKnDdG3iXw9eTFijk3EWSunZcFi54Zka4wmtqtt6rPxc8'
          ]
        })
      ]
    }
  })

  DOM.peerCount().innerText = 0
  setInterval(() => {
    DOM.peerCount().innerText = helia.libp2p.getPeers().length
  }, 1000)

  clearStatus()
  showStatus(`Waiting for peers...`)

  while (true) {
    if (helia.libp2p.getPeers().length > 0) {
      break
    }

    await new Promise((resolve) => {
      setTimeout(() => {
        resolve()
      }, 1000)
    })
  }

  clearStatus()
  showStatus('Helia node ready', COLORS.active)
  showStatus(`Libp2p PeerID: ${helia.libp2p.peerId.toString()}`, COLORS.active)
  showStatus('Try running identify with a Peer ID or a Multiaddr', COLORS.active)
  showStatus('E.g. /dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN', COLORS.active)

  DOM.identifyBtn().disabled = false
}

App().catch(err => {
  console.error(err) // eslint-disable-line no-console
})
