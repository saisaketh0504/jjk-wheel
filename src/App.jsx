import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Wheel } from 'react-custom-roulette'
import Confetti from 'react-confetti'
import './App.css'
import { updateSessionState, listenToSessionState } from './firebase'

const STORAGE_KEY = 'jjk-wheel-state-v1'

const INITIAL_CHARACTERS = [
  'Gojo Satoru',
  'Ryomen Sukuna',
  'Toji Fushiguro',
  'Suguru Geto',
  'Yuta Okkotsu',
  'Maki Zenin',
  'Mahoraga',
  'Megumi Fushiguro',
  'Yuji Itadori',
  'Nanami Kento',
  'Choso',
  'Nobara Kugisaki',
  'Mahito',
  'Jogo',
  'Yuki Tsukumo',
  'Hakari',
]

// Map character names to images placed under public/images
const characterImages = {
  'Gojo Satoru': '/images/gojo.jpeg',
  'Ryomen Sukuna': '/images/sukuna.jpeg',
  'Toji Fushiguro': '/images/toji.jpg',
  'Suguru Geto': '/images/geto.jpeg',
  'Yuta Okkotsu': '/images/yuta.jpg',
  'Maki Zenin': '/images/maki.jpeg',
  'Mahoraga': '/images/mahoraga.jpeg',
  'Megumi Fushiguro': '/images/megumi.jpeg',
  'Yuji Itadori': '/images/yuji.jpeg',
  'Nanami Kento': '/images/nanami.jpeg',
  'Choso': '/images/choso.jpeg',
  'Nobara Kugisaki': '/images/nobara.jpeg',
  'Mahito': '/images/mahito.jpeg',
  'Jogo': '/images/jogo.jpg',
  'Yuki Tsukumo': '/images/yuki.jpeg',
  'Hakari': '/images/hakari.jpeg',
}

function saveToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    // ignore
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

export default function App() {
  const stored = useMemo(() => loadFromStorage(), [])

  const [remaining, setRemaining] = useState(stored?.remaining ?? INITIAL_CHARACTERS)
  const [eliminated, setEliminated] = useState(stored?.eliminated ?? [])
  const [lastAction, setLastAction] = useState(stored?.lastAction ?? null)

  const [mustStartSpinning, setMustStartSpinning] = useState(false)
  const [prizeNumber, setPrizeNumber] = useState(0)
  const [selected, setSelected] = useState(stored?.lastSelected ?? null)
  const [showModal, setShowModal] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [copiedText, setCopiedText] = useState('')
  const [sessionId] = useState(() => {
    // Check URL parameter first: ?session=my-session-name
    const params = new URLSearchParams(window.location.search)
    const urlSession = params.get('session')
    
    if (urlSession) {
      localStorage.setItem('jjk-session-id', urlSession)
      return urlSession
    }
    
    // Default session - everyone joins this automatically
    return 'jjk-default-group'
  })
  const wheelRef = useRef(null)

  useEffect(() => {
    saveToStorage({ remaining, eliminated, lastAction, lastSelected: selected })
  }, [remaining, eliminated, lastAction, selected])

  // Listen to Firebase for real-time sync from other devices
  useEffect(() => {
    console.log('🔄 Setting up Firebase listener for session:', sessionId)
    try {
      const unsubscribe = listenToSessionState(sessionId, (remoteState) => {
        console.log('📡 Received update from Firebase:', remoteState)
        if (remoteState && remoteState.remaining && remoteState.eliminated) {
          setRemaining(remoteState.remaining)
          setEliminated(remoteState.eliminated)
          if (remoteState.selected) {
            setSelected(remoteState.selected)
            setShowModal(true)
            setCelebrate(true)
          }
        }
      })
      return unsubscribe
    } catch (e) {
      console.error('Firebase listener error:', e)
    }
  }, [sessionId])

  useEffect(() => {
    if (!showModal) return
    const timer = setTimeout(() => {
      setShowModal(false)
    }, 5000)
    return () => clearTimeout(timer)
  }, [showModal])

  const data = remaining.map((name) => ({ option: name }))

  // Handle the last character - auto-select without spinning
  function handleLastCharacter() {
    const lastChar = remaining[0]
    const prevState = { remaining: [...remaining], eliminated: [...eliminated] }
    
    const newRemaining = []
    const newEliminated = [lastChar, ...eliminated]

    setRemaining(newRemaining)
    setEliminated(newEliminated)
    setLastAction({ type: 'eliminate', prevState })
    setSelected({ name: lastChar, image: characterImages[lastChar] || '/images/placeholder.svg' })
    setShowModal(true)
    setCelebrate(true)

    try {
      updateSessionState(sessionId, { remaining: newRemaining, eliminated: newEliminated, selected: { name: lastChar, image: characterImages[lastChar] || '/images/placeholder.svg' } })
    } catch (e) {}
  }

  function handleSpin() {
    // If only one character left, select them directly
    if (data.length === 1) {
      handleLastCharacter()
      return
    }
    if (data.length < 1) return
    const newPrize = Math.floor(Math.random() * data.length)
    setPrizeNumber(newPrize)
    setMustStartSpinning(true)
  }

  function onStopSpinning() {
    setMustStartSpinning(false)
    const chosen = data[prizeNumber]?.option
    if (!chosen) return

    // store previous state for undo
    const prevState = { remaining: [...remaining], eliminated: [...eliminated] }

    const newRemaining = remaining.filter((n) => n !== chosen)
    const newEliminated = [chosen, ...eliminated]

    setRemaining(newRemaining)
    setEliminated(newEliminated)
    setLastAction({ type: 'eliminate', prevState })
    setSelected({ name: chosen, image: characterImages[chosen] || '/images/placeholder.svg' })
    setShowModal(true)
    setCelebrate(true)

    // Sync to Firebase for other group members
    try {
      updateSessionState(sessionId, { remaining: newRemaining, eliminated: newEliminated, selected: { name: chosen, image: characterImages[chosen] || '/images/placeholder.svg' } })
    } catch (e) {
      // Firebase not configured or offline - continue with local state
    }
  }

  function handleUndo() {
    if (!lastAction) return
    if (lastAction.type === 'eliminate' && lastAction.prevState) {
      setRemaining(lastAction.prevState.remaining)
      setEliminated(lastAction.prevState.eliminated)
      setLastAction(null)
      setSelected(null)
    }
  }

  function handleReset() {
    setRemaining([...INITIAL_CHARACTERS])
    setEliminated([])
    setLastAction(null)
    setSelected(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {}
  }

  function copySessionLink() {
    const link = `${window.location.origin}${window.location.pathname}?session=${sessionId}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedText('Copied!')
      setTimeout(() => setCopiedText(''), 2000)
    })
  }

  return (
    <div className="app-root">
      <header className="header">
        <h1>JJK Character Wheel</h1>
        <p className="subtitle">Spin to pick your character to draw this time. No repeats until reset.</p>
      </header>

      <main className="main">
        <section className="wheel-section">
          {remaining.length === 1 ? (
            <div className="last-character-display">
              <div className="last-character-circle">
                <span className="last-character-name">{remaining[0]}</span>
              </div>
              <p className="last-character-hint">Last one! Hit SPIN to draw them.</p>
            </div>
          ) : remaining.length === 0 ? (
            <div className="last-character-display">
              <div className="last-character-circle empty-wheel">
                <span className="last-character-name">All Done!</span>
              </div>
              <p className="last-character-hint">Reset the wheel to start again.</p>
            </div>
          ) : (
          <div className="wheel-wrap">
            <Wheel
              mustStartSpinning={mustStartSpinning}
              prizeNumber={prizeNumber}
              data={data}
              onStopSpinning={onStopSpinning}
              backgroundColors={["#000000", "#1a1a1a"]}
              textColors={["#ffffff"]}
              outerBorderColor={"#fff"}
              innerBorderColor={"#fff"}
              radiusLineColor={"#fff"}
              radiusLineWidth={1}
              fontSize={18}
              fontFamily={"Inter, system-ui, sans-serif"}
              spinDuration={0.8}
            />
          </div>
          )}

          <div className="controls">
            <button className="btn primary" onClick={handleSpin} disabled={mustStartSpinning || remaining.length < 1}>
              SPIN
            </button>
            <button className="btn secondary" onClick={handleUndo} disabled={!lastAction}>
              UNDO
            </button>
            <button className="btn danger" onClick={handleReset}>
              Reset Wheel
            </button>
            <button className="btn info" onClick={() => setShowPanel(!showPanel)}>
              {showPanel ? 'Hide' : 'Show'} Info
            </button>
          </div>
        </section>

        {showPanel && (
        <aside className="side">
          <div className="selected-card">
            <div className="selected-label">This time you draw:</div>
            {selected ? (
              <div className="selected-content">
                <img src={selected.image} alt={selected.name} className="selected-image" onError={(e)=>{e.target.src='/images/placeholder.svg'}} />
                <div className="selected-name">{selected.name}</div>
              </div>
            ) : (
              <div className="selected-empty">No character selected yet. Spin the wheel!</div>
            )}
          </div>

          <div className="eliminated">
            <h3>Drawing History</h3>
            {eliminated.length === 0 ? (
              <div className="empty">No characters drawn yet</div>
            ) : (
              <ul>
                {eliminated.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </div>
        </aside>
        )}
      </main>

      <footer className="footer"></footer>

      {showModal && selected && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          {celebrate && <Confetti recycle={false} numberOfPieces={200} gravity={0.3} />}
          <div className="modal-content">
            <img src={selected.image} alt={selected.name} className="modal-image" onError={(e)=>{e.target.src='/images/placeholder.svg'}} />
            <div className="modal-text">
              <div className="modal-label">This time you draw:</div>
              <div className="modal-name">{selected.name}</div>
            </div>
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
          </div>
        </div>
      )}
    </div>
  )
}
