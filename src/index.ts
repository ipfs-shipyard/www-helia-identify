import { multiaddr } from '@multiformats/multiaddr'
import { peerIdFromString } from '@libp2p/peer-id'
import { createHelia, DefaultLibp2pServices, HeliaLibp2p, libp2pDefaults } from 'helia'
import { base58btc } from 'multiformats/bases/base58'
import { devToolsMetrics } from '@libp2p/devtools-metrics'
import { identify } from '@libp2p/identify'
import type { Libp2p } from '@libp2p/interface'

const App = async () => {
  const DOM = {
    input: () => document.getElementById('input') as HTMLInputElement,
    identifyBtn: () => document.getElementById('identify-button') as HTMLButtonElement,
    output: () => document.getElementById('output') as HTMLDivElement,
    terminal: () => document.getElementById('terminal') as HTMLDivElement
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

  const showStatus = (text: string, bg?: string, id?: string) => {
    const log = DOM.output()

    const line = document.createElement('p')
    line.innerHTML = text
    if (bg != null) {
      line.style.color = bg
    }

    if (id) {
      line.id = id
    }

    log.appendChild(line)
    scrollToBottom()
  }

  const runIdentify = async (peerIdOrMultiaddr: string) => {
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

    try {
      const connection = await helia.libp2p.dial(multiaddrs)

      clearStatus()
      showStatus('Connected, running identify')

      const response = await helia.libp2p.services.identify.identify(connection, {
        signal
      })

      const data: any = {
        peerId: response.peerId.toString(),
        agentVersion: response.agentVersion,
        protocolVersion: response.protocolVersion,
        observedAddr: response.observedAddr,
        publicKey: response.publicKey && base58btc.encode(response.publicKey),
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
    } catch (err) {
      if (err instanceof Error) {
        showStatus(`<pre>${err.stack ?? ``}${err.message}</pre>`, COLORS.error)
      } else {
        console.error(err)
      }
    }
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

  const populateInputFromURL = () => {
    const params = new URLSearchParams(window.location.search)
    const peerOrMaddr = params.get('peer-or-maddr')
    if (peerOrMaddr) {
      DOM.input().value = peerOrMaddr
    }
  }

  const updateQueryParam = (value: string) => {
    const url = new URL(window.location.href)
    if (value) {
      url.searchParams.set('peer-or-maddr', value)
    } else {
      url.searchParams.delete('peer-or-maddr')
    }
    window.history.replaceState({}, '', url)
  }

  DOM.input().oninput = (e) => {
    const value = (e.target as HTMLInputElement).value.trim()
    updateQueryParam(value)
  }

  showStatus('Creating Helia node')


  const libp2p = libp2pDefaults()
  libp2p.addresses = {}
  libp2p.metrics = devToolsMetrics()
  libp2p.services.identify = identify({
    runOnConnectionOpen: false
  })

  const helia = await createHelia<Libp2p<DefaultLibp2pServices>>({
    libp2p
  })
  clearStatus()
  showStatus(`Waiting for peers...`)

  while (true) {
    if (helia.libp2p.getPeers().length > 0) {
      break
    }

    await new Promise<void>(resolve => {
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

  populateInputFromURL()
}

App().catch(err => {
  console.error(err) // eslint-disable-line no-console
})
