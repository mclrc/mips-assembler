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
  original: string,
  opcode: number,
  address: number,
  hex: string,
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
    return 0

  if (/^\d+$/.test(name))
    return parseInt(name, 10)

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
    return null

  const target = labels[label] ?? parseIntMaybeHex(label)

  return {
    original: line,
    type: 'J',
    opcode: JTYPE[name],
    address,
    target,
    hex: getJTypeHex({ opcode: JTYPE[name], target })
  }
}

const assembleRType = (line: string, { address }: Context): RType | null => {
  const names = Object.keys(RTYPE).join('|')
  const schema = new RegExp(`(${names})\\s+\\$(\\w+),\\s+(?:\\$(\\w+),)?\\s*\\$(\\w+)\\s*(?:,\\s*(\\w+))?$`)

  const match = line.match(schema)

  if (match === null)
    return null

  const [, name, rdString, rsString, rtString, shamtString] = match

  const [rd, rs, rt] = [rdString, rsString, rtString].map(assembleRegister)

  const shamt = shamtString ? parseIntMaybeHex(shamtString) : 0

  const funct = RTYPE[name]

  return {
    original: line,
    type: 'R' as const,
    opcode: 0 as const,
    rs,
    rt,
    rd,
    shamt,
    funct,
    address,
    hex: getRTypeHex({ rs, rt, rd, shamt, funct })
  }
}

const parseITypeSchemas = (line: string) => {
  const names = Object.keys(ITYPE).join('|')
  const schemaA = new RegExp(`(${names})\\s+\\$(\\w+),(?:\\s+\\$(\\w+),)?\\s*(-?\\w+)$`)
  const schemaB = new RegExp(`(${names})\\s+\\$(\\w+),\\s+(-?\\w+)?(:?\\(\\$(\\w+)\\))?$`)

  const matchA = line.match(schemaA)
  const matchB = line.match(schemaB)

  if (matchA) {
    const [, name, rt, rs, immediate] = matchA
    return { name, rt, rs, immediate }
  } else if (matchB) {
    const [, name, rt, immediate = "0", rs] = matchB
    return { name, rt, immediate, rs }
  }

  return null
}

const assembleIType = (line: string, { address, labels }: Context): IType | null => {
  const parsedSchema = parseITypeSchemas(line)

  if (parsedSchema === null)
    return null

  const { name, rt: rtString, rs: rsString, immediate: immediateString } = parsedSchema

  const opcode = ITYPE[name]

  const isBranch = Object.keys(BRANCH).includes(name)

  const branchOffset = (labels[immediateString] ?? parseIntMaybeHex(immediateString)) - (address + 4) / 4

  const immediate = isBranch ? branchOffset : parseIntMaybeHex(immediateString)

  const rt = assembleRegister(rtString)
  const rs = assembleRegister(rsString)

  return {
    type: 'I' as const,
    original: line,
    opcode,
    address,
    rs,
    rt,
    immediate,
    hex: getITypeHex({ opcode, rs, rt, immediate })
  }
}

const toTwosComplementHex = (num: number, width = 8) =>
  num >= 0
    ? num.toString(16).padStart(width, '0')
    : (Math.pow(2, width * 4) + num).toString(16).padStart(width, '0')

const getITypeHex = (instruction: Pick<IType, "opcode" | "rs" | "rt" | "immediate">) => {
  const { opcode, rs, rt, immediate } = instruction
  const immediateNormalized = parseInt(toTwosComplementHex(immediate, 4), 16)
  return toTwosComplementHex((opcode << 26) | (rs << 21) | (rt << 16) | immediateNormalized)
}

const getRTypeHex = (instruction: Pick<RType, "rs" | "rt" | "rd" | "shamt" | "funct">) => {
  const { rs, rt, rd, shamt, funct } = instruction
  const shamtNormalized = parseInt(toTwosComplementHex(shamt, 5), 16)
  return toTwosComplementHex((rs << 21) | (rt << 16) | (rd << 11) | (shamtNormalized << 6) | funct)
}

const getJTypeHex = (instruction: Pick<JType, "opcode" | "target">) => {
  const { opcode, target } = instruction
  return toTwosComplementHex((opcode << 26) | (target & 0x3FFFFFF))
}

const assembleLine = (line: string, address: Context) =>
  assembleRType(line, address) ?? assembleIType(line, address) ?? assembleJType(line, address)

export const assemble = (code: string, startingAddressHex: string) => {
  const lines = code.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  const startingAddress = parseIntMaybeHex(startingAddressHex)

  const labels = {}
  let numLabels = 0
  lines.forEach((line, idx) => {
    if (line.endsWith(':')) {
      labels[line.slice(0, -1)] = startingAddress + (idx - numLabels) * 4
      numLabels++
    }
  })

  const globalContext = { labels, startingAddress }

  return lines
    .filter((line) => !line.endsWith(":"))
    .map((line, idx) => assembleLine(line, {
      ...globalContext,
      address: startingAddress + 4 * idx
    }))
}
