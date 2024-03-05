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

const RTYPE_FUNCTS = {
  sll: 0,
  srl: 1,
  jr: 8,
  add: 32,
  sub: 34,
  and: 36,
  or: 37,
  slt: 42,
};

const JTYPE_OPCODES = {
  j: 2,
  jal: 3,
};

const BRANCH_OPCODES = {
  beq: 4,
  beqz: 4,
  bne: 5,
  blez: 6,
  bgtz: 7,
};

const MEMORY_OPCODES = {
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

const ITYPE_OPCODES = {
  ...BRANCH_OPCODES,
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
    // Matches lines like `add $t0, $t1, $t2`
    `(${Object.keys(RTYPE_FUNCTS).join('|')})\\s+\\$(\\w+),\\s+(?:\\$(\\w+),)?\\s*\\$(\\w+)\\s*(?:,\\s*(\\w+))?$`
  ),
  ITYPE: new RegExp(
    // Matches lines like `addi $t0, $t1, 10`, and `beq $t0, $t1, L1`
    `(${Object.keys(ITYPE_OPCODES).join('|')})\\s+\\$(\\w+),(?:\\s+\\$(\\w+),)?\\s*(-?\\w+)$`
  ),
  ITYPE_MEMORY: new RegExp(
    // Matches memory instructions like `lw $t0, 10($t1)` and `sw $t0, ($t1)`
    `(${Object.keys(MEMORY_OPCODES).join('|')})\\s+\\$(\\w+),\\s+(-?\\w+)?(?:\\(\\$(\\w+)\\))?$`
  ),
};

/// Create a part of the register map.
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
  // Also map the numbers to themselves
  ...range(32).reduce((acc, i) => ({ ...acc, [i.toString()]: i }), {}),
};

/// Parse a string to an integer, allowing for hex numbers
const parseIntMaybeHex = (str: string) =>
  str.startsWith('0x') ? parseInt(str, 16) : parseInt(str, 10);

/// Convert a number to a 2's complement representation
export const to2k = (num: number, width = 8) =>
  num >= 0 ? num : Math.pow(2, width) + num;

/// Convert a number to a 2's complement hex representation
const to2kHex = (num: number, width = 8) =>
  to2k(num, width * 4)
    .toString(16)
    .padStart(width, '0');

/// Parse a jump instruction
const parseJType = (
  line: string,
  { labels, address }: Context
): JType | null => {
  const [name, label] = line.split(' ');

  if (!Object.keys(JTYPE_OPCODES).includes(name)) return null;

  const target = labels[label] ?? parseIntMaybeHex(label);

  const opcode = JTYPE_OPCODES[name];

  return {
    original: line,
    type: 'J',
    opcode,
    address,
    target,
    hex: calcJTypeHex({ opcode, target }),
  };
};

/// Calculate the hex representation of a jump instruction
const calcJTypeHex = ({ opcode, target }: Pick<JType, 'opcode' | 'target'>) =>
  `0x${to2kHex((opcode << 26) | ((target & 0x3ffffff) >> 2))}`;

/// Parse an R type instruction
const parseRType = (line: string, { address }: Context): RType | null => {
  const match = line.match(COMMAND_SCHEMAS.RTYPE);

  if (match === null) return null;

  const [, name, rdString, rsString, rtString, shamtString] = match;

  const [rd, rs, rt] = [rdString, rsString, rtString].map(
    (reg) => REGISTER_MAP[reg] ?? 0
  );

  const shamt = shamtString ? parseIntMaybeHex(shamtString) : 0;

  const funct = RTYPE_FUNCTS[name];

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

const calcRTypeHex = ({
  rs,
  rt,
  rd,
  shamt,
  funct,
}: Pick<RType, 'rs' | 'rt' | 'rd' | 'shamt' | 'funct'>) =>
  `0x${to2kHex(
    (rs << 21) | (rt << 16) | (rd << 11) | (to2k(shamt, 5) << 6) | funct
  )}`;

/// Parse the two possible I type schemas into a common format
const parseITypeSchemas = (line: string) => {
  const matchA = line.match(COMMAND_SCHEMAS.ITYPE);
  const matchB = line.match(COMMAND_SCHEMAS.ITYPE_MEMORY);

  if (matchA) {
    const [, name, rs, rt, immediate] = matchA;
    return { name, rs, rt, immediate };
  } else if (matchB) {
    const [, name, rt, immediate = '0', rs] = matchB;
    return { name, rt, immediate, rs };
  }

  return null;
};

/// Parse an I type instruction
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

  const opcode = ITYPE_OPCODES[name];

  const isBranch = Object.keys(BRANCH_OPCODES).includes(name);

  // If it's a branch instruction, calculate the branch offset
  const branchOffset =
    ((labels[immediateString] ?? parseIntMaybeHex(immediateString)) -
      (address + 4)) /
    4;

  // Immediate might be negative, so we need to convert it to 2's complement
  const immediate = to2k(
    isBranch ? branchOffset : parseIntMaybeHex(immediateString),
    16
  );

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

/// Calculate the hex representation of an I type instruction
const calcITypeHex = ({
  opcode,
  rs,
  rt,
  immediate,
}: Pick<IType, 'opcode' | 'rs' | 'rt' | 'immediate'>) =>
  `0x${to2kHex((opcode << 26) | (rt << 16) | (rs << 21) | to2k(immediate, 16))}`;

/// Parse a line of code
export const parseLine = (line: string, address: Context) =>
  parseRType(line, address) ??
  parseIType(line, address) ??
  parseJType(line, address);

/// Parse a program
export const parse = (code: string, startingAddressString: string) => {
  const lines = code
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
    .map((l) => (l.indexOf('#') === -1 ? l : l.substring(0, l.indexOf('#'))))
    // trim again to remove any whitespace before the comment (if comment was in same line as instruction)
    .map((l) => l.trim());

  const startingAddress = parseIntMaybeHex(startingAddressString);

  // Compute the label addresses
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
