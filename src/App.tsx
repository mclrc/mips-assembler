import React, { useMemo } from 'react'
import { useState } from 'react'
import './App.css'
import { assemble } from './assemble'
import { omit } from 'lodash-es'

const exampleCode =
  `L0:
ori $a0, $a0, 16384
lui $a1, 46080
ori $a1, $a1, 1016
L1:
lb $a2, 0($a0)
beq $zero, $a2, L2
sll $zero, $zero, $zero
sb $a2, 0($a1)
j L1
L2:
sll $zero, $zero, $zero
lui $a1, 49087
ori $a1, $a1, 4
lui $a2, 0
ori $a2, $a2, 42
sb $a2, 0($a1)
j L0
`

// Should only contain a basic text area for he MIPS code
function App() {
  const [startAddress, setStartAddress] = useState("0")
  const [code, setCode] = useState(exampleCode)
  const [error, setError] = useState<string | null>(null)

  const assembled = useMemo(() => {
    try {
      const result = assemble(code, startAddress)
      console.log(result)
      if (result === null) {
        setError("Failed to assemble")
        return []
      }
      setError(null)
      return result
    } catch (e) {
      setError(JSON.stringify(e))
      console.error(e);
      return []
    }
  }, [code, startAddress])

  return (
    <div className="App" style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      <p>MIPS Assembler</p>
      <div style={{ display: "flex" }}>
        <span>Startaddresse</span><input type="text" value={startAddress} onChange={(e) => setStartAddress(e.target.value)} style={{ flex: 1, marginLeft: "1rem" }} />
      </div>
      <textarea value={code} onChange={(e) => setCode(e.target.value)} style={{ resize: "vertical", width: "100%", minHeight: 300 }} />
      <table>
        <tbody>
          {assembled && assembled.map((line, i) => line === null ? (
            <tr>
              <td>Parsing error</td>
            </tr>
          ) : (
            <tr key={i}>
              <td>
                {`0x${line.address.toString(16).padStart(8, "0")}`}
              </td>
              <td>
                {line.original}
              </td>
              {Object.entries(omit(line, "address", "original", "hex")).map(([key, value]) => (
                <td key={key} style={{ marginRight: "1rem" }}>{`${key}=${value}`}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <a style={{ marginTop: "2rem" }} href="https://github.com/mclrc/mips-assembler">Source code</a>
    </div>

  )
}

export default App
