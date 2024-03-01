import React, { useMemo } from 'react';
import { useState } from 'react';
import { IType, Instruction, JType, RType, parse } from './parser';
import './App.css';

const exampleCode = `L0:
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
beqz $a2, L2
`;

const formatHex = (n: number | string, length?: number) => {
  const hex = n.toString(16);
  return length === undefined ? `0x${hex}` : `0x${hex.padStart(length, '0')}`;
};

const RTypeInstruction = ({
  address,
  hex,
  original,
  opcode,
  rs,
  rt,
  rd,
  shamt,
  funct,
}: RType) => (
  <tr className="instruction rtype">
    <td>{formatHex(address)}</td>
    <td>{original}</td>
    <td>{formatHex(hex, 8)}</td>
    <td>
      {opcode}({funct})
    </td>
    <td>rs={rs}</td>
    <td>rs={rt}</td>
    <td>rd={rd}</td>
    <td>shamt={shamt}</td>
  </tr>
);

const ITypeInstruction = ({
  address,
  hex,
  original,
  opcode,
  rs,
  rt,
  immediate,
}: IType) => (
  <tr className="instruction itype">
    <td>{formatHex(address)}</td>
    <td>{original}</td>
    <td>{formatHex(hex, 8)}</td>
    <td>{opcode}</td>
    <td>rs={rs}</td>
    <td>rt={rt}</td>
    <td colSpan={2}>imm={immediate}</td>
  </tr>
);

const JTypeInstruction = ({
  address,
  original,
  hex,
  opcode,
  target,
}: JType) => (
  <tr className="instruction jtype">
    <td>{formatHex(address)}</td>
    <td>{original}</td>
    <td>{formatHex(hex, 8)}</td>
    <td>{opcode}</td>
    <td colSpan={4}>target={target}</td>
  </tr>
);

const InstructionInfo = ({ instruction }: { instruction: Instruction }) => {
  switch (instruction.type) {
    case 'R':
      return <RTypeInstruction {...instruction} />;
    case 'I':
      return <ITypeInstruction {...instruction} />;
    case 'J':
      return <JTypeInstruction {...instruction} />;
  }
};

function App() {
  const [startAddress, setStartAddress] = useState('0');
  const [code, setCode] = useState(exampleCode);
  const [error, setError] = useState<string | null>(null);

  const assembled = useMemo(() => {
    try {
      const result = parse(code, startAddress);
      if (result === null) {
        setError('Failed to assemble');
        return [];
      }
      setError(null);
      return result;
    } catch (e) {
      setError(JSON.stringify(e));
      console.error(e);
      return [];
    }
  }, [code, startAddress]);

  return (
    <div id="App">
      <h1>MIPS Assembler</h1>
      <h2>Assemble and inspect a subset of MIPS assembly</h2>
      <span className="label">Starting address</span>
      <input
        type="text"
        value={startAddress}
        onChange={(e) => setStartAddress(e.target.value)}
      />
      <span className="label">Code</span>
      <textarea value={code} onChange={(e) => setCode(e.target.value)} />
      <table>
        <thead>
          <tr>
            <th>Addr</th>
            <th>Asm</th>
            <th>Hex</th>
            <th>Op(funct)</th>
          </tr>
        </thead>
        <tbody>
          {assembled &&
            assembled.map((line, i) =>
              line === null ? (
                <tr key={i} className="error-row">
                  <td>Parsing error</td>
                </tr>
              ) : (
                <InstructionInfo key={i} instruction={line} />
              )
            )}
        </tbody>
      </table>
      {error && <p className="error">{error}</p>}
      <a href="https://github.com/mclrc/mips-assembler">Source code</a>
    </div>
  );
}

export default App;
