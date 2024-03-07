import React, { useMemo, useState } from 'react';
import { IType, JType, LabelLine, RType, parse } from '../parser';
import './App.css';

const EXAMPLE_CODE = `L0:
ori $a0, $a0, 16384
lui $a1, 46080
L1:
lb $a2, 0($a0)
beq $zero, $a2, L2
sll $zero, $zero, $zero
sb $a2, 0($a1)
j L1
L2:
sll $zero, $zero, $zero
ori $a1, $a1, 4
sb $a2, 0($a1)
beqz $a2, L2
`;

const formatHex = (n: number, length?: number) => {
  const hex = n.toString(16);
  return length === undefined ? `0x${hex}` : `0x${hex.padStart(length, '0')}`;
};

const RTypeRow = ({
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
    <td>{hex}</td>
    <td>
      {opcode}({funct})
    </td>
    <td>rs={rs}</td>
    <td>rt={rt}</td>
    <td>rd={rd}</td>
    <td>shamt={shamt}</td>
  </tr>
);

const ITypeRow = ({
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
    <td>{hex}</td>
    <td>{opcode}</td>
    <td>rs={rs}</td>
    <td>rt={rt}</td>
    <td colSpan={2}>imm={immediate}</td>
  </tr>
);

const JTypeRow = ({ address, original, hex, opcode, target }: JType) => (
  <tr className="instruction jtype">
    <td>{formatHex(address)}</td>
    <td>{original}</td>
    <td>{hex}</td>
    <td>{opcode}</td>
    <td colSpan={4}>target={target}</td>
  </tr>
);

const LabelRow = ({
  address,
  original,
}: {
  address: number;
  original: string;
}) => (
  <tr className="instruction">
    <td>{formatHex(address)}</td>
    <td colSpan={7}>{original}</td>
  </tr>
);

const InstructionRow = ({
  instruction,
}: {
  instruction: RType | IType | JType | LabelLine;
}) => {
  switch (instruction.type) {
    case 'R':
      return <RTypeRow {...instruction} />;
    case 'I':
      return <ITypeRow {...instruction} />;
    case 'J':
      return <JTypeRow {...instruction} />;
    case 'L':
      return <LabelRow {...instruction} />;
  }
};

function App() {
  const [startAddress, setStartAddress] = useState('0x00400000');
  const [code, setCode] = useState(EXAMPLE_CODE);
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
                  <td colSpan={4}>Parsing error</td>
                </tr>
              ) : (
                <InstructionRow key={i} instruction={line} />
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
