export interface ProblemParams {
	R: number; // Radio de la prisión
	vp: number; // Velocidad radial del fugitivo
	vd: number; // Velocidad tangencial de los drones
	rd: number; // Radio de la órbita de los drones (= R/2)
	rv: number; // Radio del cono de visión (= R/2)
	n: number; // Número de slots discretos sobre la órbita
}

interface ModelData {
	n: number; // Número de variables binarias x_i
	K: number; // Ventana temporal de exposición (pasos)
	V: number[]; // Offsets angulares cubiertos por un dron
	dt: number; // Paso temporal Δt
	T: number; // Período orbital del dron
	alpha: number; // Ancho angular del cono de visión
}

/**
 * Construye los parámetros derivados (K, V, dt) a partir de los parámetros
 * físicos del problema. Esta es la traducción directa de la Sección 3 de la
 * tarea: discretización temporal y angular.
 */
function buildModel(p: ProblemParams): ModelData {
	const T = (2 * Math.PI * p.rd) / p.vd;

	const dt = T / p.n;

	const tauE = p.R / p.vp;

	const K = Math.floor(tauE / dt);

	const rWorst = p.R;
	const ratio = Math.min(1.0, p.rv / (2 * rWorst));
	const alpha = 2 * Math.asin(ratio);

	const slotsPerHalfAlpha = Math.floor(alpha / 2 / ((2 * Math.PI) / p.n));
	const V: number[] = [];
	for (let k = -slotsPerHalfAlpha; k <= slotsPerHalfAlpha; k++) V.push(k);

	return { n: p.n, K, V, dt, T, alpha };
}

/**
 * Genera la matriz de restricciones del problema Set Covering.
 * Devuelve, para cada restricción i, la lista de índices de variables
 * que aparecen en el lado izquierdo (con coeficiente 1).
 *
 *      restricción_i:   Σ_{j∈cols[i]} x_j ≥ 1
 */
function buildConstraints(m: ModelData): number[][] {
	const { n, K, V } = m;
	const cols: number[][] = [];
	for (let i = 0; i < n; i++) {
		const row = new Set<number>();
		for (let j = 0; j <= K; j++) {
			for (const k of V) {
				// Módulo positivo (en JS, el operador % puede devolver negativos)
				const idx = (((i + j + k) % n) + n) % n;
				row.add(idx);
			}
		}
		cols.push(Array.from(row).sort((a, b) => a - b));
	}
	return cols;
}

interface LPResult {
	feasible: boolean;
	objective: number;
	x: number[];
}

const EPS = 1e-9;
const BIG_M = 1e7;

/**
 * Resuelve  min c·x  s.a. A·x ≥ b, x_i ∈ [lb_i, ub_i] mediante
 * simplex con Gran-M. Las cotas se imponen añadiendo restricciones
 * x_i ≤ ub_i y x_i ≥ lb_i (estas últimas solo si lb_i > 0).
 */
function solveLP(c: number[], A: number[][], b: number[], lb: number[], ub: number[]): LPResult {
	const nVar = c.length;

	// Construimos las filas finales del sistema en forma A'x ≥ b' y A'x ≤ b'
	// que luego pasaremos a forma estándar.
	type Row = { coef: number[]; sign: -1 | 1; rhs: number };
	const rows: Row[] = [];

	// 1) Restricciones originales A·x ≥ b
	for (let i = 0; i < A.length; i++) {
		rows.push({ coef: A[i].slice(), sign: 1, rhs: b[i] });
	}
	// 2) Cotas superiores  x_i ≤ ub_i  (solo si ub finito)
	for (let j = 0; j < nVar; j++) {
		if (Number.isFinite(ub[j])) {
			const r = new Array(nVar).fill(0);
			r[j] = 1;
			rows.push({ coef: r, sign: -1, rhs: ub[j] });
		}
	}
	// 3) Cotas inferiores  x_i ≥ lb_i  (solo si lb > 0)
	for (let j = 0; j < nVar; j++) {
		if (lb[j] > 0) {
			const r = new Array(nVar).fill(0);
			r[j] = 1;
			rows.push({ coef: r, sign: 1, rhs: lb[j] });
		}
	}

	// ------------------------------------------------------------------
	// Forma estándar: cada fila pasa a igualdad introduciendo slack/surplus
	// y, donde haga falta, una variable artificial penalizada con M.
	//
	//   A·x ≥ b   ⇒   A·x − s + a = b,   s, a ≥ 0   (a penalizada con +M)
	//   A·x ≤ b   ⇒   A·x + s     = b,   s     ≥ 0
	// ------------------------------------------------------------------
	const m = rows.length;
	let totalVars = nVar; // variables que iremos añadiendo

	// Estructura del tableau: filas de m restricciones, columnas en el orden
	//   [ x_1 ... x_n | extras... | rhs ]
	const tableau: number[][] = rows.map((r) => r.coef.slice());
	const rhs: number[] = rows.map((r) => r.rhs);
	const cExt: number[] = c.slice(); // costo extendido
	const basis: number[] = new Array(m).fill(-1);

	// Aseguramos rhs ≥ 0 (si rhs < 0, multiplicamos la fila por -1
	// invirtiendo el sentido de la desigualdad).
	for (let i = 0; i < m; i++) {
		if (rhs[i] < 0) {
			for (let j = 0; j < tableau[i].length; j++) tableau[i][j] = -tableau[i][j];
			rhs[i] = -rhs[i];
			rows[i].sign = (rows[i].sign === 1 ? -1 : 1) as -1 | 1;
		}
	}

	// Añadimos slacks, surplus y artificiales fila por fila
	for (let i = 0; i < m; i++) {
		if (rows[i].sign === 1) {
			// ≥  ⇒  −surplus  +  artificial
			// surplus:
			tableau.forEach((row, k) => row.push(k === i ? -1 : 0));
			cExt.push(0);
			totalVars++;
			// artificial:
			tableau.forEach((row, k) => row.push(k === i ? 1 : 0));
			cExt.push(BIG_M);
			basis[i] = totalVars;
			totalVars++;
		} else {
			// ≤  ⇒  +slack
			tableau.forEach((row, k) => row.push(k === i ? 1 : 0));
			cExt.push(0);
			basis[i] = totalVars;
			totalVars++;
		}
	}

	// Función auxiliar: costos reducidos z_j − c_j
	const reducedCosts = (): number[] => {
		const z = new Array(totalVars).fill(0);
		for (let j = 0; j < totalVars; j++) {
			let s = 0;
			for (let i = 0; i < m; i++) s += cExt[basis[i]] * tableau[i][j];
			z[j] = s - cExt[j];
		}
		return z;
	};

	// Iteración principal del simplex
	const MAX_ITER = 5000;
	for (let iter = 0; iter < MAX_ITER; iter++) {
		const z = reducedCosts();

		// Variable entrante: la de mayor z_j − c_j positivo (regla de Dantzig).
		let pivotCol = -1;
		let best = EPS;
		for (let j = 0; j < totalVars; j++) {
			if (z[j] > best) {
				best = z[j];
				pivotCol = j;
			}
		}
		if (pivotCol === -1) break; // óptimo alcanzado

		// Variable saliente: ratio test
		let pivotRow = -1;
		let minRatio = Infinity;
		for (let i = 0; i < m; i++) {
			if (tableau[i][pivotCol] > EPS) {
				const ratio = rhs[i] / tableau[i][pivotCol];
				if (ratio < minRatio - EPS) {
					minRatio = ratio;
					pivotRow = i;
				}
			}
		}
		if (pivotRow === -1) {
			// Problema no acotado (no debería pasar en este modelo)
			return { feasible: false, objective: Infinity, x: [] };
		}

		// Pivoteo
		const pivotVal = tableau[pivotRow][pivotCol];
		for (let j = 0; j < totalVars; j++) tableau[pivotRow][j] /= pivotVal;
		rhs[pivotRow] /= pivotVal;
		for (let i = 0; i < m; i++) {
			if (i === pivotRow) continue;
			const factor = tableau[i][pivotCol];
			if (Math.abs(factor) < EPS) continue;
			for (let j = 0; j < totalVars; j++) {
				tableau[i][j] -= factor * tableau[pivotRow][j];
			}
			rhs[i] -= factor * rhs[pivotRow];
		}
		basis[pivotRow] = pivotCol;
	}

	// Extraemos la solución
	const x = new Array(nVar).fill(0);
	for (let i = 0; i < m; i++) {
		if (basis[i] < nVar) x[basis[i]] = rhs[i];
	}

	// Si alguna artificial quedó en la base con valor > 0 ⇒ infactible
	for (let i = 0; i < m; i++) {
		if (basis[i] >= nVar && cExt[basis[i]] >= BIG_M - 1 && rhs[i] > EPS) {
			return { feasible: false, objective: Infinity, x: [] };
		}
	}

	let obj = 0;
	for (let j = 0; j < nVar; j++) obj += c[j] * x[j];
	return { feasible: true, objective: obj, x };
}

function solveILP(c: number[], A: number[][], b: number[]): LPResult {
	const nVar = c.length;
	const initLB = new Array(nVar).fill(0);
	const initUB = new Array(nVar).fill(1);

	let bestObj = Infinity;
	let bestX: number[] = [];

	// Pila de subproblemas
	const stack: { lb: number[]; ub: number[] }[] = [{ lb: initLB, ub: initUB }];

	while (stack.length > 0) {
		const node = stack.pop()!;
		const res = solveLP(c, A, b, node.lb, node.ub);
		if (!res.feasible) continue;

		// Poda por cota
		if (res.objective >= bestObj - EPS) continue;

		// ¿Solución entera?
		let fracIdx = -1;
		let fracBest = 0;
		for (let j = 0; j < nVar; j++) {
			const v = res.x[j];
			const frac = Math.abs(v - Math.round(v));
			if (frac > 1e-6 && frac > fracBest) {
				fracBest = frac;
				fracIdx = j;
			}
		}
		if (fracIdx === -1) {
			// Entera: actualizamos el mejor
			if (res.objective < bestObj - EPS) {
				bestObj = res.objective;
				bestX = res.x.map((v) => Math.round(v));
			}
			continue;
		}

		// Ramificación: x_fracIdx = 0  y  x_fracIdx = 1
		const ub0 = node.ub.slice();
		ub0[fracIdx] = 0;
		stack.push({ lb: node.lb.slice(), ub: ub0 });

		const lb1 = node.lb.slice();
		lb1[fracIdx] = 1;
		stack.push({ lb: lb1, ub: node.ub.slice() });
	}

	if (!Number.isFinite(bestObj)) {
		return { feasible: false, objective: Infinity, x: [] };
	}
	return { feasible: true, objective: bestObj, x: bestX };
}

interface SimResult {
	trials: number;
	intercepted: number;
	rate: number;
}

function monteCarloValidation(
	p: ProblemParams,
	m: ModelData,
	dronePositions: number[],
	trials: number = 10000
): SimResult {
	const dtheta = (2 * Math.PI) / p.n; // ancho angular de un slot
	let intercepted = 0;

	for (let t = 0; t < trials; t++) {
		const theta = Math.random() * 2 * Math.PI; // ángulo de escape
		const t0 = Math.random() * m.T; // instante de inicio
		const tauE = p.R / p.vp; // tiempo total de escape

		let caught = false;
		// Discretizamos el tiempo de escape en sub-pasos finos
		const subSteps = Math.max(50, m.K * 4);
		for (let s = 0; s <= subSteps; s++) {
			const tau = (s / subSteps) * tauE;
			const r = p.vp * tau;
			// Posición cartesiana del fugitivo (centro de la prisión = origen)
			const px = r * Math.cos(theta);
			const py = r * Math.sin(theta);

			// Posición de cada dron en el instante t0 + tau
			for (const slot of dronePositions) {
				const phi0 = slot * dtheta; // ángulo inicial
				const phi = phi0 + (p.vd / p.rd) * (t0 + tau); // ángulo actual
				const dx = p.rd * Math.cos(phi);
				const dy = p.rd * Math.sin(phi);
				const dist = Math.hypot(px - dx, py - dy);
				if (dist <= p.rv + 1e-6) {
					caught = true;
					break;
				}
			}
			if (caught) break;
		}
		if (caught) intercepted++;
	}

	return {
		trials,
		intercepted,
		rate: intercepted / trials
	};
}

export const resolveCircle = (params: ProblemParams): number[] => {
	const model = buildModel(params);
	const cols = buildConstraints(model);
	const nVar = model.n;
	const c = new Array(nVar).fill(1); // min Σ x_i
	const A: number[][] = cols.map((idxs) => {
		const row = new Array(nVar).fill(0);
		for (const j of idxs) row[j] = 1;
		return row;
	});
	const b = new Array(cols.length).fill(1);
	const result = solveILP(c, A, b);
	const chosen: number[] = [];
	result.x.forEach((v, i) => {
		if (v > 0.5) chosen.push(i);
	});

	return chosen.map((i) => (i * 2 * Math.PI) / model.n);
};
