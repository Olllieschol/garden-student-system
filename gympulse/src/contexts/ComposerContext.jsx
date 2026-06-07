import { createContext, useContext, useState } from 'react'

const ComposerContext = createContext(null)

export function ComposerProvider({ children }) {
  const [composerMember, setComposerMember] = useState(null)
  return (
    <ComposerContext.Provider value={{ composerMember, openComposer: setComposerMember, closeComposer: () => setComposerMember(null) }}>
      {children}
    </ComposerContext.Provider>
  )
}

export const useComposer = () => useContext(ComposerContext)
