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

// Predetermined order for selection (appears random but follows this sequence)
const PREDETERMINED_ORDER = [
  'Yuta Okkotsu',
  'Choso',
  'Megumi Fushiguro',
  'Nobara Kugisaki',
  'Toji Fushiguro',
  'Yuki Tsukumo',
  'Yuji Itadori',
  'Mahito',
  'Jogo',
  'Gojo Satoru',
  'Hakari',
  'Maki Zenin',
  'Suguru Geto',
  'Nanami Kento',
  'Ryomen Sukuna',
  'Mahoraga',
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
  const [characters, setCharacters] = useState([]) // All characters always stay on wheel
  const [selectedCharacters, setSelectedCharacters] = useState([]) // Characters that have been picked (shown as white)
  // lastAction is LOCAL-only for undo functionality (not synced across devices)
  const [lastAction, setLastAction] = useState(null)
  // Loading state to prevent showing "All Done" before Firebase loads
  const [isLoading, setIsLoading] = useState(true)

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
  // FIREBASE INITIALIZATION + LISTENER: Combined to prevent race conditions
  // 1. First check if session needs initialization
  // 2. Initialize if needed
  // 3. THEN start listening for real-time updates
  // ============================================================================
  useEffect(() => {
    let unsubscribe = null
    let timeoutId = null
    
    async function initAndListen() {
      console.log('🚀 Initializing session:', sessionId)
      
      // Timeout fallback - if Firebase doesn't respond in 5 seconds, stop loading
      timeoutId = setTimeout(() => {
        console.warn('⏰ Firebase timeout - initializing with default characters')
        setIsLoading(false)
        if (characters.length === 0) {
          setCharacters([...INITIAL_CHARACTERS])
        }
      }, 5000)
      
      try {
        // Step 1: Check if session needs initialization (only once)
        if (!sessionInitialized.current) {
          sessionInitialized.current = true
          
          const existingState = await getSessionState(sessionId)
          
          // Determine if we need to initialize the session:
          // 1. No data exists at all
          // 2. characters is undefined/null
          // 3. Session is empty (corrupted/new session)
          const needsInitialization = !existingState || existingState.initialized !== true

          
          if (needsInitialization) {
            console.log('📝 No valid session found, creating new session with initial characters')
            await updateSessionState(sessionId, {
  initialized: true,
  characters: INITIAL_CHARACTERS,
  selectedCharacters: [],
  selected: null
})

          } else {
            console.log('✅ Found existing session data:', existingState)
          }
        }
        
        // Step 2: NOW start listening for real-time updates (after initialization is complete)
        console.log('🔄 Setting up Firebase listener for session:', sessionId)
        unsubscribe = listenToSessionState(sessionId, (remoteState) => {
  console.log('📡 Received update from Firebase:', remoteState)

  // Clear timeout since Firebase responded
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }

  // ✅ Firebase responded → stop loading NO MATTER WHAT
  setIsLoading(false)

  // If session doesn't exist yet, wait for initialization write
  if (!remoteState) return

  setCharacters(remoteState.characters ?? remoteState.remaining ?? [])
  setSelectedCharacters(remoteState.selectedCharacters ?? remoteState.eliminated ?? [])
  setSelected(remoteState.selected ?? null)

  if (remoteState.selected) {
    setShowModal(true)
    setCelebrate(true)
  }

  // Prevent undo conflicts from other devices
  setLastAction(null)
})


      } catch (e) {
        console.error('Firebase initialization/listener error:', e)
        // On error, stop loading and use defaults
        setIsLoading(false)
        if (characters.length === 0) {
          setCharacters([...INITIAL_CHARACTERS])
        }
      }
    }
    
    initAndListen()
    
    // Cleanup listener and timeout on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [sessionId])

  useEffect(() => {
    if (!showModal) return
    const timer = setTimeout(() => {
      setShowModal(false)
    }, 5000)
    return () => clearTimeout(timer)
  }, [showModal])

  // Create wheel data with colors based on whether character was selected
  const data = characters.map((name, index) => {
    const isSelected = selectedCharacters.includes(name)
    return { 
      option: name,
      style: {
        backgroundColor: isSelected ? '#ffffff' : (index % 2 === 0 ? '#000000' : '#1a1a1a'),
        textColor: isSelected ? '#000000' : '#ffffff'
      }
    }
  })

  // Check if all characters have been selected
  const allSelected = characters.length > 0 && selectedCharacters.length === characters.length
  // Get remaining (unselected) characters for spin logic
  const remainingCharacters = characters.filter(c => !selectedCharacters.includes(c))

  function handleSpin() {
    if (remainingCharacters.length < 1 || data.length < 1) return
    
    // Pick the next character from the predetermined order
    const nextChar = PREDETERMINED_ORDER.find(name => !selectedCharacters.includes(name))
    const chosenName = nextChar || remainingCharacters[0]
    // Find the index of this character in the full wheel data
    const prizeIdx = characters.indexOf(chosenName)
    
    setPrizeNumber(prizeIdx)
    setMustStartSpinning(true)
  }

  function onStopSpinning() {
    setMustStartSpinning(false)
    const chosen = data[prizeNumber]?.option
    if (!chosen) return

    // store previous state for undo
    const prevState = { characters: [...characters], selectedCharacters: [...selectedCharacters] }

    const newSelectedCharacters = [chosen, ...selectedCharacters]

    setSelectedCharacters(newSelectedCharacters)
    setLastAction({ type: 'select', prevState })
    setSelected({ name: chosen, image: characterImages[chosen] || '/images/placeholder.svg' })
    setShowModal(true)
    setCelebrate(true)

    // Sync to Firebase for other group members
    try {
      updateSessionState(sessionId, { initialized: true, characters: characters, selectedCharacters: newSelectedCharacters, selected: { name: chosen, image: characterImages[chosen] || '/images/placeholder.svg' } })
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
    if (lastAction.type === 'select' && lastAction.prevState) {
      const prevCharacters = lastAction.prevState.characters
      const prevSelectedCharacters = lastAction.prevState.selectedCharacters
      
      // Update local state
      setCharacters(prevCharacters)
      setSelectedCharacters(prevSelectedCharacters)
      setLastAction(null)
      setSelected(null)
      
      // Sync undo result to Firebase so all devices see the restored state
      try {
        updateSessionState(sessionId, {
          initialized: true,
          characters: prevCharacters,
          selectedCharacters: prevSelectedCharacters,
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
    const freshCharacters = [...INITIAL_CHARACTERS]
    const freshSelectedCharacters = []
    
    // Update local state
    setCharacters(freshCharacters)
    setSelectedCharacters(freshSelectedCharacters)
    setLastAction(null)
    setSelected(null)
    
    // Sync reset to Firebase so all devices see the fresh state
    try {
      updateSessionState(sessionId, {
        initialized: true,
        characters: freshCharacters,
        selectedCharacters: freshSelectedCharacters,
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
          {isLoading ? (
            <div className="last-character-display">
              <div className="last-character-circle">
                <span className="last-character-name">Loading...</span>
              </div>
              <p className="last-character-hint">Connecting to session...</p>
            </div>
          ) : allSelected && characters.length > 0 ? (
            <div className="last-character-display">
              <div className="last-character-circle empty-wheel">
                <span className="last-character-name">All Done!</span>
              </div>
              <p className="last-character-hint">Reset the wheel to start again.</p>
            </div>
          ) : characters.length === 0 ? (
            <div className="last-character-display">
              <div className="last-character-circle">
                <span className="last-character-name">Preparing…</span>
              </div>
              <p className="last-character-hint">Syncing session data</p>
            </div>
          ) : (
          <div className="wheel-wrap">
            <Wheel
              mustStartSpinning={mustStartSpinning}
              prizeNumber={prizeNumber}
              data={data}
              onStopSpinning={onStopSpinning}
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
            <button className="btn primary" onClick={handleSpin} disabled={mustStartSpinning || remainingCharacters.length < 1}>
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
            {selectedCharacters.length === 0 ? (
              <div className="empty">No characters drawn yet</div>
            ) : (
              <ul>
                {selectedCharacters.map((c) => (
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
