import React, { useEffect, useRef, useState } from 'react'
import { Wheel } from 'react-custom-roulette'
import Confetti from 'react-confetti'
import './App.css'
import { updateSessionState, listenToSessionState, getSessionState } from './firebase'

// Initial characters used when creating a new session
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

// ============================================================================
// STATE MANAGEMENT: Firebase is the SINGLE source of truth
// - All state is synced from Firebase in real-time
// - No localStorage usage - all devices see the same state
// - Local state is only used for UI rendering, Firebase data always wins
// ============================================================================

export default function App() {
  // Initialize all state as empty - Firebase will populate on mount
  const [remaining, setRemaining] = useState([])
  const [eliminated, setEliminated] = useState([])
  // lastAction is LOCAL-only for undo functionality (not synced across devices)
  const [lastAction, setLastAction] = useState(null)

  const [mustStartSpinning, setMustStartSpinning] = useState(false)
  const [prizeNumber, setPrizeNumber] = useState(0)
  const [selected, setSelected] = useState(null)
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
  
  // Track if we've initialized the session to prevent duplicate writes
  const sessionInitialized = useRef(false)

  // ============================================================================
  // FIREBASE INITIALIZATION: Check if session exists, create if not
  // This runs once on mount to ensure session data exists in Firebase
  // ============================================================================
  useEffect(() => {
    async function initializeSession() {
      if (sessionInitialized.current) return
      sessionInitialized.current = true
      
      console.log('🚀 Initializing session:', sessionId)
      try {
        const existingState = await getSessionState(sessionId)
        
        // If no session data exists in Firebase, initialize with default characters
        if (!existingState || !existingState.remaining) {
          console.log('📝 No existing session found, creating new session with initial characters')
          await updateSessionState(sessionId, {
            remaining: INITIAL_CHARACTERS,
            eliminated: [],
            selected: null
          })
        } else {
          console.log('✅ Found existing session data:', existingState)
        }
      } catch (e) {
        console.error('Failed to initialize session:', e)
      }
    }
    
    initializeSession()
  }, [sessionId])

  // ============================================================================
  // FIREBASE LISTENER: Real-time sync from Firebase to local state
  // Firebase is the source of truth - all remote updates override local state
  // ============================================================================
  useEffect(() => {
    console.log('🔄 Setting up Firebase listener for session:', sessionId)
    try {
      const unsubscribe = listenToSessionState(sessionId, (remoteState) => {
        console.log('📡 Received update from Firebase:', remoteState)
        if (remoteState) {
          // Update remaining (default to empty array if not present)
          if (remoteState.remaining !== undefined) {
            setRemaining(remoteState.remaining || [])
          }
          
          // Update eliminated (default to empty array if not present)
          if (remoteState.eliminated !== undefined) {
            setEliminated(remoteState.eliminated || [])
          }
          
          // Update selected and show modal for new selections
          if (remoteState.selected !== undefined) {
            setSelected(remoteState.selected)
            // Show celebration modal when a character is selected
            if (remoteState.selected) {
              setShowModal(true)
              setCelebrate(true)
            }
          }
          
          // Clear local undo history when receiving remote updates
          // This prevents undo conflicts across devices
          setLastAction(null)
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

  // ============================================================================
  // UNDO: Local-only history, but syncs result to Firebase
  // Undo restores previous state locally, then pushes to Firebase
  // ============================================================================
  function handleUndo() {
    if (!lastAction) return
    if (lastAction.type === 'eliminate' && lastAction.prevState) {
      const prevRemaining = lastAction.prevState.remaining
      const prevEliminated = lastAction.prevState.eliminated
      
      // Update local state
      setRemaining(prevRemaining)
      setEliminated(prevEliminated)
      setLastAction(null)
      setSelected(null)
      
      // Sync undo result to Firebase so all devices see the restored state
      try {
        updateSessionState(sessionId, {
          remaining: prevRemaining,
          eliminated: prevEliminated,
          selected: null
        })
      } catch (e) {
        console.error('Failed to sync undo to Firebase:', e)
      }
    }
  }

  // ============================================================================
  // RESET: Restore all characters and sync to Firebase
  // ============================================================================
  function handleReset() {
    const freshRemaining = [...INITIAL_CHARACTERS]
    const freshEliminated = []
    
    // Update local state
    setRemaining(freshRemaining)
    setEliminated(freshEliminated)
    setLastAction(null)
    setSelected(null)
    
    // Sync reset to Firebase so all devices see the fresh state
    try {
      updateSessionState(sessionId, {
        remaining: freshRemaining,
        eliminated: freshEliminated,
        selected: null
      })
    } catch (e) {
      console.error('Failed to sync reset to Firebase:', e)
    }
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
