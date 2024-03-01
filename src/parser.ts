import { range } from 'lodash-es';

type InstructionBase = {
  original: string;
  opcode: number;
  address: number;
  hex: string;
};

export type RType = InstructionBase & {
  type: 'R';
  opcode: 0;
  rs: number;
  rt: number;
  rd: number;
  shamt: number;
  funct: number;
};

export type IType = InstructionBase & {
  type: 'I';
  rs: number;
  rt: number;
  immediate: number;
};

export type JType = InstructionBase & {
  type: 'J';
  target: number;
};

export type Instruction = RType | IType | JType;

type Context = {
  labels: Record<string, number>;
  startingAddress: number;
  address: number;
};

const RTYPE = {
  sll: 0,
  srl: 1,
  jr: 8,
  add: 32,
  sub: 34,
  and: 36,
  or: 37,
  slt: 42,
};

const JTYPE = {
  j: 2,
  jal: 3,
};

const BRANCH = {
  beq: 4,
  beqz: 4,
  bne: 5,
  blez: 6,
  bgtz: 7,
};

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
};

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
  beq: 4,
};

const COMMAND_SCHEMAS = {
  RTYPE: new RegExp(
    `(${Object.keys(RTYPE).join('|')})\\s+\\$(\\w+),\\s+(?:\\$(\\w+),)?\\s*\\$(\\w+)\\s*(?:,\\s*(\\w+))?$`
  ),
  ITYPE1: new RegExp(
    `(${Object.keys(ITYPE).join('|')})\\s+\\$(\\w+),(?:\\s+\\$(\\w+),)?\\s*(-?\\w+)$`
  ),
  ITYPE2: new RegExp(
    `(${Object.keys(ITYPE).join('|')})\\s+\\$(\\w+),\\s+(-?\\w+)?(:?\\(\\$(\\w+)\\))?$`
  ),
};

const createRegisterMappings = (
  prefix: string,
  offset: number,
  count: number,
  start: number = 0
) =>
  range(count).reduce(
    (acc, i) => ({ ...acc, [`${prefix}${start + i}`]: i + offset }),
    {}
  );

const REGISTER_MAP = {
  zero: 0,
  at: 1,
  ...createRegisterMappings('v', 2, 2),
  ...createRegisterMappings('a', 4, 4),
  ...createRegisterMappings('t', 8, 8),
  ...createRegisterMappings('s', 16, 8),
  ...createRegisterMappings('t', 24, 2, 8),
  ...createRegisterMappings('k', 26, 2),
  gp: 28,
  sp: 29,
  fp: 30,
  ra: 31,
  ...range(32).reduce((acc, i) => ({ ...acc, [i.toString()]: i }), {}),
};

const parseIntMaybeHex = (str: string) =>
  str.startsWith('0x') ? parseInt(str, 16) : parseInt(str, 10);

const toTwosComplementHex = (num: number, width = 8) =>
  num >= 0
    ? num.toString(16).padStart(width, '0')
    : (Math.pow(2, width * 4) + num).toString(16).padStart(width, '0');

const parseJType = (
  line: string,
  { labels, address }: Context
): JType | null => {
  const [name, label] = line.split(' ');

  if (!Object.keys(JTYPE).includes(name)) return null;

  const target = labels[label] ?? parseIntMaybeHex(label);

  return {
    original: line,
    type: 'J',
    opcode: JTYPE[name],
    address,
    target,
    hex: calcJTypeHex({ opcode: JTYPE[name], target }),
  };
};

const calcJTypeHex = (instruction: Pick<JType, 'opcode' | 'target'>) => {
  const { opcode, target } = instruction;
  return toTwosComplementHex((opcode << 26) | (target & 0x3ffffff));
};

const parseRType = (line: string, { address }: Context): RType | null => {
  const match = line.match(COMMAND_SCHEMAS.RTYPE);

  if (match === null) return null;

  const [, name, rdString, rsString, rtString, shamtString] = match;

  const [rd, rs, rt] = [rdString, rsString, rtString].map(
    (reg) => REGISTER_MAP[reg] ?? 0
  );

  const shamt = shamtString ? parseIntMaybeHex(shamtString) : 0;

  const funct = RTYPE[name];

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
    hex: calcRTypeHex({ rs, rt, rd, shamt, funct }),
  };
};

const calcRTypeHex = (
  instruction: Pick<RType, 'rs' | 'rt' | 'rd' | 'shamt' | 'funct'>
) => {
  const { rs, rt, rd, shamt, funct } = instruction;
  const shamtNormalized = parseInt(toTwosComplementHex(shamt, 5), 16);
  return toTwosComplementHex(
    (rs << 21) | (rt << 16) | (rd << 11) | (shamtNormalized << 6) | funct
  );
};

const parseITypeSchemas = (line: string) => {
  const matchA = line.match(COMMAND_SCHEMAS.ITYPE1);
  const matchB = line.match(COMMAND_SCHEMAS.ITYPE2);

  if (matchA) {
    const [, name, rt, rs, immediate] = matchA;
    return { name, rt, rs, immediate };
  } else if (matchB) {
    const [, name, rt, immediate = '0', rs] = matchB;
    return { name, rt, immediate, rs };
  }

  return null;
};

const parseIType = (
  line: string,
  { address, labels }: Context
): IType | null => {
  const parsedSchema = parseITypeSchemas(line);

  if (parsedSchema === null) return null;

  const {
    name,
    rt: rtString,
    rs: rsString,
    immediate: immediateString,
  } = parsedSchema;

  const opcode = ITYPE[name];

  const isBranch = Object.keys(BRANCH).includes(name);

  const branchOffset =
    (labels[immediateString] ?? parseIntMaybeHex(immediateString)) -
    (address + 4) / 4;

  const immediate = isBranch ? branchOffset : parseIntMaybeHex(immediateString);

  const rt = REGISTER_MAP[rtString] ?? 0;
  const rs = REGISTER_MAP[rsString] ?? 0;

  return {
    type: 'I' as const,
    original: line,
    opcode,
    address,
    rs,
    rt,
    immediate,
    hex: calcITypeHex({ opcode, rs, rt, immediate }),
  };
};

const calcITypeHex = (
  instruction: Pick<IType, 'opcode' | 'rs' | 'rt' | 'immediate'>
) => {
  const { opcode, rs, rt, immediate } = instruction;
  const immediateNormalized = parseInt(toTwosComplementHex(immediate, 4), 16);
  return toTwosComplementHex(
    (opcode << 26) | (rs << 21) | (rt << 16) | immediateNormalized
  );
};

const parseLine = (line: string, address: Context) =>
  parseRType(line, address) ??
  parseIType(line, address) ??
  parseJType(line, address);

export const parse = (code: string, startingAddressString: string) => {
  const lines = code
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const startingAddress = parseIntMaybeHex(startingAddressString);

  const labels = {};
  let numLabels = 0;
  lines.forEach((line, idx) => {
    if (line.endsWith(':')) {
      labels[line.slice(0, -1)] = startingAddress + (idx - numLabels) * 4;
      numLabels++;
    }
  });

  const globalContext = { labels, startingAddress };

  return lines
    .filter((line) => !line.endsWith(':'))
    .map((line, idx) =>
      parseLine(line, {
        ...globalContext,
        address: startingAddress + 4 * idx,
      })
    );
};
