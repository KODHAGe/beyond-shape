/**
 * In-repo classic marching cubes (spec §3.4) over a Float32Array scalar field
 * → {positions, normals, indices} in BufferGeometry-compatible form, with
 * global vertex merging (watertight across cells) and field-gradient normals.
 *
 * The 256-case triangulation table is the canonical Paul-Bourke table, embedded
 * compactly as "caseIndex a b c …" lines (triples; no -1 terminator needed).
 * Complement symmetry (case c ↔ 255-c share the same crossing-edge set) holds
 * for every row — asserted by a unit test so a typo cannot hide.
 */

export interface MarchMesh {
  /** Vertex positions, x fastest: [v0x, v0y, v0z, v1x, …]. */
  positions: Float32Array;
  /** Vertex normals (field gradient at the vertex, outward for SDFs). */
  normals: Float32Array;
  /** Triangle indices into positions, groups of 3. */
  indices: Uint32Array;
}

// ── Table (canonical Bourke tri table: "caseIndex e0 e1 e2 …") ────────────────
const TRI_TABLE_STR = `
1 0 8 3
2 0 1 9
3 1 8 3 9 8 1
4 1 2 10
5 0 8 3 1 2 10
6 9 2 10 0 2 9
7 2 8 3 2 10 8 10 9 8
8 3 11 2
9 0 11 2 8 11 0
10 1 9 0 2 3 11
11 1 11 2 1 9 11 9 8 11
12 3 10 1 11 10 3
13 0 10 1 0 8 10 8 11 10
14 3 9 0 3 11 9 11 10 9
15 9 8 10 10 8 11
16 4 7 8
17 4 3 0 7 3 4
18 0 1 9 8 4 7
19 4 1 9 4 7 1 7 3 1
20 1 2 10 8 4 7
21 3 4 7 3 0 4 1 2 10
22 9 2 10 9 0 2 8 4 7
23 2 10 9 2 9 7 2 7 3 7 9 4
24 8 4 7 3 11 2
25 11 4 7 11 2 4 2 0 4
26 9 0 1 8 4 7 2 3 11
27 4 7 11 9 4 11 9 11 2 9 2 1
28 3 10 1 3 11 10 7 8 4
29 1 11 10 1 4 11 1 0 4 7 11 4
30 4 7 8 9 0 11 9 11 10 11 0 3
31 4 7 11 4 11 9 9 11 10
32 9 5 4
33 9 5 4 0 8 3
34 0 5 4 1 5 0
35 8 5 4 8 3 5 3 1 5
36 1 2 10 9 5 4
37 3 0 8 1 2 10 4 9 5
38 5 2 10 5 4 2 4 0 2
39 2 10 5 3 2 5 3 5 4 3 4 8
40 9 5 4 2 3 11
41 0 11 2 0 8 11 4 9 5
42 0 5 4 0 1 5 2 3 11
43 2 1 5 2 5 8 2 8 11 4 8 5
44 10 3 11 10 1 3 9 5 4
45 4 9 5 0 8 1 8 10 1 8 11 10
46 5 4 0 5 0 11 5 11 10 11 0 3
47 5 4 8 5 8 10 10 8 11
48 9 7 8 5 7 9
49 9 3 0 9 5 3 5 7 3
50 0 7 8 0 1 7 1 5 7
51 1 5 3 3 5 7
52 9 7 8 9 5 7 10 1 2
53 10 1 2 9 5 0 5 3 0 5 7 3
54 8 0 2 8 2 5 8 5 7 10 5 2
55 2 10 5 2 5 3 3 5 7
56 7 9 5 7 8 9 3 11 2
57 9 5 7 9 7 2 9 2 0 2 7 11
58 2 3 11 0 1 8 1 7 8 1 5 7
59 11 2 1 11 1 7 7 1 5
60 9 5 8 8 5 7 10 1 3 10 3 11
61 5 7 0 5 0 9 7 11 0 1 0 10 11 10 0
62 11 10 0 11 0 3 10 5 0 8 0 7 5 7 0
63 11 10 5 7 11 5
64 10 6 5
65 0 8 3 5 10 6
66 9 0 1 5 10 6
67 1 8 3 9 8 1 5 10 6
68 1 6 5 2 6 1
69 1 6 5 1 2 6 3 0 8
70 9 6 5 9 0 6 0 2 6
71 5 9 8 5 8 2 5 2 6 3 2 8
72 2 3 11 10 6 5
73 11 0 8 11 2 0 10 6 5
74 0 1 9 2 3 11 5 10 6
75 5 10 6 1 9 2 9 11 2 9 8 11
76 6 3 11 6 5 3 5 1 3
77 0 8 11 0 11 5 0 5 1 5 11 6
78 3 11 6 0 3 6 0 6 5 0 5 9
79 6 5 9 6 9 11 11 9 8
80 5 10 6 4 7 8
81 4 3 0 4 7 3 6 5 10
82 1 9 0 5 10 6 8 4 7
83 10 6 5 1 9 7 1 7 3 7 9 4
84 6 1 2 6 5 1 4 7 8
85 1 2 5 5 2 6 3 0 4 3 4 7
86 8 4 7 9 0 5 0 6 5 0 2 6
87 7 3 9 7 9 4 3 2 9 2 6 9 5 9 6
88 3 11 2 7 8 4 10 6 5
89 5 10 6 4 7 2 4 2 0 2 7 11
90 0 1 9 4 7 8 2 3 11 5 10 6
91 9 2 1 9 11 2 9 4 11 4 7 11 5 10 6
92 8 4 7 3 11 5 3 5 1 5 11 6
93 5 1 11 5 11 6 1 0 11 7 11 4 0 4 11
94 3 11 6 3 6 0 0 6 5 0 5 9 8 4 7
95 6 5 9 6 9 11 4 7 9 7 11 9
96 10 4 9 6 4 10
97 4 10 6 4 9 10 0 8 3
98 10 0 1 10 6 0 6 4 0
99 8 3 1 8 1 6 8 6 4 6 1 10
100 1 4 9 1 2 4 2 6 4
101 3 0 8 1 2 9 2 6 9 6 4 9
102 0 2 4 4 2 6
103 8 3 2 8 2 4 4 2 6
104 10 4 9 10 6 4 11 2 3
105 0 8 2 2 8 11 4 9 10 4 10 6
106 3 11 2 0 1 6 0 6 4 6 1 10
107 6 4 1 6 1 10 4 8 1 2 1 11 8 11 1
108 9 6 4 9 3 6 9 1 3 11 6 3
109 8 11 1 8 1 0 11 6 1 9 1 4 6 4 1
110 3 11 6 3 6 0 0 6 4
111 6 4 8 11 6 8
112 7 10 6 7 8 10 8 9 10
113 0 7 3 0 10 7 0 9 10 6 7 10
114 10 6 7 1 10 7 1 7 8 1 8 0
115 10 6 7 10 7 1 1 7 3
116 1 2 6 1 6 8 1 8 9 8 6 7
117 2 6 9 2 9 1 6 7 9 0 9 3 7 3 9
118 7 8 0 7 0 6 6 0 2
119 7 3 2 6 7 2
120 2 3 11 10 6 8 10 8 9 8 6 7
121 2 0 7 2 7 11 0 9 7 6 7 10 9 10 7
122 1 8 0 1 7 8 1 10 7 6 7 10 2 3 11
123 11 2 1 11 1 7 10 6 1 6 7 1
124 8 9 6 8 6 7 9 1 6 11 6 3 1 3 6
125 0 9 1 11 6 7
126 7 8 0 7 0 6 3 11 0 11 6 0
127 7 11 6
128 7 6 11
129 3 0 8 11 7 6
130 0 1 9 11 7 6
131 8 1 9 8 3 1 11 7 6
132 10 1 2 6 11 7
133 1 2 10 3 0 8 6 11 7
134 2 9 0 2 10 9 6 11 7
135 6 11 7 2 10 3 10 8 3 10 9 8
136 7 2 3 6 2 7
137 7 0 8 7 6 0 6 2 0
138 2 7 6 2 3 7 0 1 9
139 1 6 2 1 8 6 1 9 8 8 7 6
140 10 7 6 10 1 7 1 3 7
141 10 7 6 1 7 10 1 8 7 1 0 8
142 0 3 7 0 7 10 0 10 9 6 10 7
143 7 6 10 7 10 8 8 10 9
144 6 8 4 11 8 6
145 3 6 11 3 0 6 0 4 6
146 8 6 11 8 4 6 9 0 1
147 9 4 6 9 6 3 9 3 1 11 3 6
148 6 8 4 6 11 8 2 10 1
149 1 2 10 3 0 11 0 6 11 0 4 6
150 4 11 8 4 6 11 0 2 9 2 10 9
151 10 9 3 10 3 2 9 4 3 4 6 3 11 3 6
152 8 2 3 8 4 2 4 6 2
153 0 4 2 4 6 2
154 1 9 0 2 3 4 2 4 6 4 3 8
155 1 9 4 1 4 2 2 4 6
156 8 1 3 8 6 1 8 4 6 6 10 1
157 10 1 0 10 0 6 6 0 4
158 4 6 3 4 3 8 6 10 3 0 3 9 10 9 3
159 10 9 4 6 10 4
160 4 9 5 7 6 11
161 0 8 3 4 9 5 11 7 6
162 5 0 1 5 4 0 7 6 11
163 11 7 6 8 3 4 3 5 4 3 1 5
164 9 5 4 10 1 2 7 6 11
165 6 11 7 1 2 10 0 8 3 4 9 5
166 7 6 11 5 4 10 4 2 10 4 0 2
167 3 4 8 3 5 4 3 2 5 2 10 5 11 7 6
168 7 2 3 7 6 2 5 4 9
169 9 5 4 0 8 6 0 6 2 6 8 7
170 3 6 2 3 7 6 1 5 0 5 4 0
171 6 2 8 6 8 7 2 1 8 4 8 5 1 5 8
172 9 5 4 10 1 6 1 7 6 1 3 7
173 1 6 10 1 7 6 1 0 7 8 7 0 9 5 4
174 4 0 10 4 10 5 0 3 10 6 10 7 3 7 10
175 7 6 10 7 10 8 5 4 10 4 8 10
176 6 9 5 6 11 9 11 8 9
177 3 6 11 0 6 3 0 5 6 0 9 5
178 0 11 8 0 5 11 0 1 5 5 6 11
179 6 11 3 6 3 5 5 3 1
180 1 2 10 9 5 11 9 11 8 11 5 6
181 0 11 3 0 6 11 0 9 6 5 6 9 1 2 10
182 11 8 5 11 5 6 8 0 5 10 5 2 0 2 5
183 6 11 3 6 3 5 2 10 3 10 5 3
184 5 8 9 5 2 8 5 6 2 3 8 2
185 9 5 6 9 6 0 0 6 2
186 1 5 8 1 8 0 5 6 8 3 8 2 6 2 8
187 1 5 6 2 1 6
188 1 3 6 1 6 10 3 8 6 5 6 9 8 9 6
189 10 1 0 10 0 6 9 5 0 5 6 0
190 0 3 8 5 6 10
191 10 5 6
192 11 5 10 7 5 11
193 11 5 10 11 7 5 8 3 0
194 5 11 7 5 10 11 1 9 0
195 10 7 5 10 11 7 9 8 1 8 3 1
196 11 1 2 11 7 1 7 5 1
197 0 8 3 1 2 7 1 7 5 7 2 11
198 9 7 5 9 2 7 9 0 2 2 11 7
199 7 5 2 7 2 11 5 9 2 3 2 8 9 8 2
200 2 5 10 2 3 5 3 7 5
201 8 2 0 8 5 2 8 7 5 10 2 5
202 9 0 1 5 10 3 5 3 7 3 10 2
203 9 8 2 9 2 1 8 7 2 10 2 5 7 5 2
204 1 3 5 3 7 5
205 0 8 7 0 7 1 1 7 5
206 9 0 3 9 3 5 5 3 7
207 9 8 7 5 9 7
208 5 8 4 5 10 8 10 11 8
209 5 0 4 5 11 0 5 10 11 11 3 0
210 0 1 9 8 4 10 8 10 11 10 4 5
211 10 11 4 10 4 5 11 3 4 9 4 1 3 1 4
212 2 5 1 2 8 5 2 11 8 4 5 8
213 0 4 11 0 11 3 4 5 11 2 11 1 5 1 11
214 0 2 5 0 5 9 2 11 5 4 5 8 11 8 5
215 9 4 5 2 11 3
216 2 5 10 3 5 2 3 4 5 3 8 4
217 5 10 2 5 2 4 4 2 0
218 3 10 2 3 5 10 3 8 5 4 5 8 0 1 9
219 5 10 2 5 2 4 1 9 2 9 4 2
220 8 4 5 8 5 3 3 5 1
221 0 4 5 1 0 5
222 8 4 5 8 5 3 9 0 5 0 3 5
223 9 4 5
224 4 11 7 4 9 11 9 10 11
225 0 8 3 4 9 7 9 11 7 9 10 11
226 1 10 11 1 11 4 1 4 0 7 4 11
227 3 1 4 3 4 8 1 10 4 7 4 11 10 11 4
228 4 11 7 9 11 4 9 2 11 9 1 2
229 9 7 4 9 11 7 9 1 11 2 11 1 0 8 3
230 11 7 4 11 4 2 2 4 0
231 11 7 4 11 4 2 8 3 4 3 2 4
232 2 9 10 2 7 9 2 3 7 7 4 9
233 9 10 7 9 7 4 10 2 7 8 7 0 2 0 7
234 3 7 10 3 10 2 7 4 10 1 10 0 4 0 10
235 1 10 2 8 7 4
236 4 9 1 4 1 7 7 1 3
237 4 9 1 4 1 7 0 8 1 8 7 1
238 4 0 3 7 4 3
239 4 8 7
240 9 10 8 10 11 8
241 3 0 9 3 9 11 11 9 10
242 0 1 10 0 10 8 8 10 11
243 3 1 10 11 3 10
244 1 2 11 1 11 9 9 11 8
245 3 0 9 3 9 11 1 2 9 2 11 9
246 0 2 11 8 0 11
247 3 2 11
248 2 3 8 2 8 10 10 8 9
249 9 10 2 0 9 2
250 2 3 8 2 8 10 0 1 8 1 10 8
251 1 10 2
252 1 3 8 9 1 8
253 0 9 1
254 0 3 8
255
`;

function parseTriTable(raw: string): (readonly number[])[] {
  const table: (readonly number[])[] = new Array(256);
  table[0] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const nums = trimmed.split(/\s+/).map(Number) as number[];
    const caseIdx = nums[0]!;
    if (caseIdx < 1 || caseIdx > 255) continue;
    if (nums.length % 3 !== 1) {
      throw new Error(`marching cubes table: invalid row for case ${caseIdx}`);
    }
    table[caseIdx] = nums.slice(1);
  }
  for (let i = 1; i < 256; i += 1) if (!table[i]) table[i] = [];
  return table;
}

const TRI_TABLE: (readonly number[])[] = parseTriTable(TRI_TABLE_STR);

/** 12 cube edges as (cornerA, cornerB) pairs (Bourke indexing). */
const EDGES: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

/** Corner unit offsets in (x, y, z). */
const CORNERS: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];

/** Crossing-edge bitmask for a case (derivable from the cube topology). */
export function computeEdgeMask(caseIndex: number): number {
  let mask = 0;
  for (let e = 0; e < 12; e += 1) {
    const [a, b] = EDGES[e]!;
    if (((caseIndex >> a) ^ (caseIndex >> b)) & 1) mask |= 1 << e;
  }
  return mask;
}

/** Every triangle edge in a case must be a crossing edge of that case. */
export function triTableEdgeInvariant(): boolean {
  for (let c = 0; c < 256; c += 1) {
    const mask = computeEdgeMask(c);
    for (const e of TRI_TABLE[c]!) {
      if ((mask & (1 << e)) === 0) return false;
    }
  }
  return true;
}

export interface MarchCubesOptions {
  isolevel?: number;
}

/**
 * March a scalar field on a regular grid into a triangle mesh.
 * field: Float32Array length nx*ny*nz, index = z*ny*nx + y*nx + x.
 * min/max: world coordinates of the first/last grid point.
 */
export function marchCubes(
  field: Float32Array,
  nx: number,
  ny: number,
  nz: number,
  min: number,
  max: number,
  options: MarchCubesOptions = {},
): MarchMesh {
  const iso = options.isolevel ?? 0;
  const V = nx * ny * nz;
  if (field.length < V) throw new RangeError(`field length ${field.length} < grid volume ${V}`);
  const h = (max - min) / (nx - 1);
  const grad = computeGradients(field, nx, ny, nz, h);

  const pos: number[] = [];
  const ind: number[] = [];
  const norm: number[] = [];
  // Global vertex merge across cells: the world-space edge (identified by its
  // two grid-corner linear indices, order-independent) maps to one vertex.
  const merged = new Map<number, number>();
  // Per-cell cache: edge index (0..11) → merged vertex, cleared each cell.
  const edgeVertex = new Map<number, number>();

  const cornerVal = (ix: number, iy: number, iz: number, i: number): number => {
    const [dx, dy, dz] = CORNERS[i]!;
    return field[(iz + dz) * ny * nx + (iy + dy) * nx + (ix + dx)] ?? 0;
  };
  const cornerGrad = (ix: number, iy: number, iz: number, i: number): [number, number, number] => {
    const [dx, dy, dz] = CORNERS[i]!;
    const g = ((iz + dz) * ny * nx + (iy + dy) * nx + (ix + dx)) * 3;
    return [grad[g] ?? 0, grad[g + 1] ?? 0, grad[g + 2] ?? 0];
  };
  // Global linear index of a cube corner's grid point.
  const cornerSlot = (ix: number, iy: number, iz: number, i: number): number => {
    const [dx, dy, dz] = CORNERS[i]!;
    return (iz + dz) * ny * nx + (iy + dy) * nx + (ix + dx);
  };
  const cornerPos = (ix: number, iy: number, iz: number, i: number): [number, number, number] => {
    const [dx, dy, dz] = CORNERS[i]!;
    return [min + (ix + dx) * h, min + (iy + dy) * h, min + (iz + dz) * h];
  };

  for (let iz = 0; iz < nz - 1; iz += 1) {
    for (let iy = 0; iy < ny - 1; iy += 1) {
      for (let ix = 0; ix < nx - 1; ix += 1) {
        let mask = 0;
        for (let i = 0; i < 8; i += 1) {
          if (cornerVal(ix, iy, iz, i) < iso) mask |= 1 << i;
        }
        if (mask === 0 || mask === 255) continue;

        edgeVertex.clear();
        const tris = TRI_TABLE[mask]!;
        for (let t = 0; t + 2 < tris.length; t += 3) {
          const e0 = tris[t]!;
          const e1 = tris[t + 1]!;
          const e2 = tris[t + 2]!;
          const a = edgeVertexFor(e0);
          const b = edgeVertexFor(e1);
          const c = edgeVertexFor(e2);
          if (a === b || b === c || a === c) continue; // degenerate — reject
          ind.push(a, b, c);
        }

        function edgeVertexFor(e: number): number {
          const cached = edgeVertex.get(e);
          if (cached !== undefined) return cached;

          const [ai, bi] = EDGES[e]!;
          const va = cornerVal(ix, iy, iz, ai);
          const vb = cornerVal(ix, iy, iz, bi);
          const denom = vb - va;
          const tCorner = denom === 0 ? 0.5 : (iso - va) / denom;
          const t = Math.min(1, Math.max(0, tCorner));

          const [ax, ay, az] = cornerPos(ix, iy, iz, ai);
          const [bx, by, bz] = cornerPos(ix, iy, iz, bi);
          const vx = ax + (bx - ax) * t;
          const vy = ay + (by - ay) * t;
          const vz = az + (bz - az) * t;

          const [gax, gay, gaz] = cornerGrad(ix, iy, iz, ai);
          const [gbx, gby, gbz] = cornerGrad(ix, iy, iz, bi);

          // Merge key: the ordered grid-corner pair, shared across touching
          // cells → identical world edge → identical vertex. No duplicates.
          const slotA = cornerSlot(ix, iy, iz, ai);
          const slotB = cornerSlot(ix, iy, iz, bi);
          const key = slotA < slotB ? slotA * V + slotB : slotB * V + slotA;

          let idx = merged.get(key);
          if (idx === undefined) {
            idx = pos.length / 3;
            pos.push(vx, vy, vz);
            norm.push(
              gax + (gbx - gax) * t,
              gay + (gby - gay) * t,
              gaz + (gbz - gaz) * t,
            );
            merged.set(key, idx);
          }
          edgeVertex.set(e, idx);
          return idx;
        }
      }
    }
  }

  return {
    positions: Float32Array.from(pos),
    normals: Float32Array.from(norm),
    indices: Uint32Array.from(ind),
  };
}

/** Central-difference field gradients at every grid point (one-sided at edges). */
function computeGradients(
  field: Float32Array,
  nx: number,
  ny: number,
  nz: number,
  h: number,
): Float32Array {
  const V = nx * ny * nz;
  const grad = new Float32Array(V * 3);
  const twoH = 2 * h;
  const slot = (x: number, y: number, z: number): number => z * ny * nx + y * nx + x;
  for (let z = 0; z < nz; z += 1) {
    for (let y = 0; y < ny; y += 1) {
      for (let x = 0; x < nx; x += 1) {
        const x0 = Math.max(x - 1, 0);
        const x1 = Math.min(x + 1, nx - 1);
        const y0 = Math.max(y - 1, 0);
        const y1 = Math.min(y + 1, ny - 1);
        const z0 = Math.max(z - 1, 0);
        const z1 = Math.min(z + 1, nz - 1);
        const gx = (field[slot(x1, y, z)]! - field[slot(x0, y, z)]!) / ((x1 - x0) * twoH);
        const gy = (field[slot(x, y1, z)]! - field[slot(x, y0, z)]!) / ((y1 - y0) * twoH);
        const gz = (field[slot(x, y, z1)]! - field[slot(x, y, z0)]!) / ((z1 - z0) * twoH);
        const g = slot(x, y, z) * 3;
        grad[g] = gx;
        grad[g + 1] = gy;
        grad[g + 2] = gz;
      }
    }
  }
  return grad;
}

/**
 * One Laplacian smoothing pass (spec §3.4): each vertex moves toward the mean
 * of its adjacent vertices (adjacency derived from the index buffer). Returns
 * a NEW positions array; the caller recomputes normals afterwards.
 */
export function laplacianSmooth(
  positions: Float32Array,
  indices: Uint32Array,
  iterations = 1,
): Float32Array {
  const nv = positions.length / 3;
  const adjacency: number[][] = new Array(nv);
  for (let i = 0; i < nv; i += 1) adjacency[i] = [];
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = indices[t]!;
    const b = indices[t + 1]!;
    const c = indices[t + 2]!;
    adjacency[a]!.push(b, c);
    adjacency[b]!.push(a, c);
    adjacency[c]!.push(a, b);
  }
  let out = new Float32Array(positions);
  for (let it = 0; it < iterations; it += 1) {
    const next = new Float32Array(out);
    for (let v = 0; v < nv; v += 1) {
      const nbrs = adjacency[v]!;
      if (nbrs.length === 0) continue;
      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (const n of nbrs) {
        sx += out[n * 3] ?? 0;
        sy += out[n * 3 + 1] ?? 0;
        sz += out[n * 3 + 2] ?? 0;
      }
      const k = 1 / nbrs.length;
      next[v * 3] = (out[v * 3] ?? 0) * (1 - 0.5) + sx * k * 0.5;
      next[v * 3 + 1] = (out[v * 3 + 1] ?? 0) * (1 - 0.5) + sy * k * 0.5;
      next[v * 3 + 2] = (out[v * 3 + 2] ?? 0) * (1 - 0.5) + sz * k * 0.5;
    }
    out = next;
  }
  return out;
}