const RTYPE = {
  sll: 0,
  srl: 1,
  jr: 8,
  add: 32,
  sub: 34,
  and: 36,
  or: 37,
  slt: 42,
}

const JTYPE = {
  j: 2,
  jal: 3,
}

const BRANCH = {
  beq: 4,
  beqz: 4,
  bne: 5,
  blez: 6,
  bgtz: 7,
}

const MEMORY = {
  lb: 32,
  lh: 33,
  lwl: 34,
  lw: 35,
  lbu: 36,
  lhu: 37,
  lwr: 38,
  sb: 40,
  sh: 41,
  swl: 42,
  sw: 43,
  swr: 46,
}

const ITYPE = {
  ...MEMORY,
  ...BRANCH,
  addi: 8,
  subi: 10,
  andi: 12,
  ori: 13,
  slti: 10,
  lui: 15,
  lw: 35,
  sw: 43,
  beq: 4
}

type InstructionBase = {
  original: string;
  opcode: number;
  address: number;
}

type RType = InstructionBase & {
  type: 'R',
  opcode: 0,
  rs: number,
  rt: number,
  rd: number,
  shamt: number,
  funct: number,
}

type IType = InstructionBase & {
  type: 'I',
  rs: number,
  rt: number,
  immediate: number
}

type JType = InstructionBase & {
  type: 'J',
  target: number,
}

type Context = {
  labels: Record<string, number>,
  startingAddress: number
  address: number
}

const parseIntMaybeHex = (str: string) => str.startsWith("0x") ? parseInt(str, 16) : parseInt(str, 10)

const assembleRegister = (name: string) => {
  if (name === undefined)
    return 0;

  if (/^\$\d+$/.test(name))
    return parseInt(name.slice(1), 10)

  const match = name.match(/([a-zA-Z]+)(\d*)/)

  if (!match)
    throw Error(`Invalid register name: ${name}`)

  const [, prefix, numberString] = match

  if (numberString === "") {
    const mapped = {
      "zero": 0,
      "at": 1,
      "sp": 29,
      "fp": 30,
      "ra": 31,
      "gp": 28,
    }[prefix]

    if (mapped === undefined)
      throw Error(`Invalid register name: ${name}`)

    return mapped
  }

  const number = parseInt(numberString, 10)

  if (prefix === "t")
    return number < 8 ? number + 8 : number + 16

  const offsetMap = {
    "v": 2,
    "a": 4,
    "t": 8,
    "s": 16
  }

  const offset = offsetMap[prefix]

  if (offset === undefined)
    throw Error(`Invalid register name: ${name}`)

  return offset + number
}

const assembleJType = (line: string, { labels, address }: Context): JType | null => {
  const [name, label] = line.split(' ')

  if (!Object.keys(JTYPE).includes(name))
    return null;

  const target = labels[label] ?? parseIntMaybeHex(label)

  return {
    original: line,
    type: 'J',
    opcode: JTYPE[name],
    address,
    target
  }
}

const assembleRType = (line: string, { address }: Context): RType | null => {
  const names = Object.keys(RTYPE).join('|')
  const schemaA = new RegExp(`(${names})\\s+\\$(\\w+),\\s+\\$(\\w+),\\s+\\$(\\w+)$`)
  const schemaB = new RegExp(`(${names})\\s+\\$(\\w+),\\s+\\$(\\w+),\\s+(\\d+)$`)

  const matchA = line.match(schemaA)
  const matchB = line.match(schemaB)

  if (matchA) {
    const [, name, rd, rs, rt] = matchA
    return {
      original: line,
      type: 'R',
      opcode: 0,
      rs: assembleRegister(rs),
      rt: assembleRegister(rt),
      rd: assembleRegister(rd),
      shamt: 0,
      funct: RTYPE[name],
      address,
    }
  }

  if (matchB) {
    const [, name, rd, rs, immediate] = matchB
    return {
      original: line,
      type: 'R',
      opcode: 0,
      rs: assembleRegister(rs),
      rt: assembleRegister(rd),
      rd: 0,
      shamt: parseIntMaybeHex(immediate),
      funct: RTYPE[name],
      address,
    }
  }

  return null;
}

const assembleIType = (line: string, { address, labels }: Context): IType | null => {
  const names = Object.keys(ITYPE).join('|')
  const schemaA = new RegExp(`(${names})\\s+\\$(\\w+),(?:\\s+\\$(\\w+),)?\\s*(\-?\w+)$`)
  const schemaB = new RegExp(`(${names})\\s+\\$(\\w+),\\s+(-?\\w+)?(:?\\(\\$(\\w+)\\))?$`)

  const matchA = line.match(schemaA)
  const matchB = line.match(schemaB)

  const name = matchA?.[1] ?? matchB?.[1];

  if (!name)
    return null;

  const isBranch = Object.keys(BRANCH).includes(name);

  if (matchA) {
    const [, name, rt, rs, immediate] = matchA

    if (isBranch) {
      const target = labels[immediate] ?? parseIntMaybeHex(immediate);
      const offset = (target - address) / 4
      return {
        original: line,
        type: 'I',
        opcode: ITYPE[name],
        rs: assembleRegister(rs),
        rt: assembleRegister(rt),
        immediate: offset,
        address,
      }
    }

    return {
      original: line,
      type: 'I',
      opcode: ITYPE[name],
      rs: assembleRegister(rs),
      rt: assembleRegister(rt),
      immediate: parseIntMaybeHex(immediate),
      address,
    }
  }
  if (matchB) {
    const [, name, rt, immediate = "0", rs] = matchB
    return {
      original: line,
      type: 'I',
      opcode: ITYPE[name],
      rs: assembleRegister(rs),
      rt: assembleRegister(rt),
      immediate: parseIntMaybeHex(immediate),
      address,
    }
  }

  return null;
}

const toTwosComplementHex = (num: number, width = 8) =>
  num >= 0
    ? num.toString(16).padStart(width, '0')
    : (Math.pow(2, width * 4) + num).toString(16).padStart(width, '0');

const assembleToHex = (instruction: RType | IType | JType) => {
  if (instruction.type === 'R') {
    const { opcode, rs, rt, rd, shamt, funct } = instruction
    return toTwosComplementHex((opcode << 26) | (rs << 21) | (rt << 16) | (rd << 11) | (shamt << 6) | funct)
  }

  if (instruction.type === 'I') {
    const { opcode, rs, rt, immediate } = instruction
    const immediateNormalized = parseInt(toTwosComplementHex(immediate, 4), 16)
    return toTwosComplementHex((opcode << 26) | (rs << 21) | (rt << 16) | immediateNormalized)
  }

  if (instruction.type === 'J') {
    const { opcode, target } = instruction
    return toTwosComplementHex((opcode << 26) | (target & 0x3FFFFFF))
  }

  throw Error(`Invalid instruction type: ${instruction}`)
}

const assembleLine = (line: string, address: Context) =>
  assembleRType(line, address) ?? assembleIType(line, address) ?? assembleJType(line, address)

export const assemble = (code: string, startingAddressHex: string) => {
  const lines = code.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  const startingAddress = parseIntMaybeHex(startingAddressHex)

  const labels = lines.reduce((acc, line, idx) => {
    if (line.endsWith(':')) {
      acc[line.slice(0, -1)] = startingAddress + (idx - acc.numLabels - 1) * 4
      acc.numLabels++
    }
    return acc
  }, { numLabels: 0 });

  const context = { labels, startingAddress }

  return lines
    .filter((line) => !line.endsWith(":"))
    .map((line, idx) => assembleLine(line, {
      ...context,
      address: startingAddress + 4 * idx
    }))
    .map(line => line === null ? null : ({
      ...line,
      hex: assembleToHex(line)
    }))
}
