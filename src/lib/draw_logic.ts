export const drawCircle = (
	ctx: CanvasRenderingContext2D,
	radius: number,
	height: number,
	width: number
) => {
	ctx.save();
	ctx.translate(height / 2, width / 2);

	ctx.beginPath();
	ctx.arc(0, 0, 2, 0, 2 * Math.PI, false);
	ctx.fillStyle = 'black';
	ctx.fill();

	ctx.beginPath();
	ctx.arc(0, 0, radius, 0, 2 * Math.PI, false);

	ctx.strokeStyle = 'black';
	ctx.stroke();

	ctx.restore();
};

export const drawPolygon = (
	ctx: CanvasRenderingContext2D,
	num_vertices: number,
	radius: number,
	height: number,
	width: number
) => {
	ctx.save();
	ctx.translate(height / 2, width / 2);

	ctx.beginPath();
	ctx.arc(0, 0, 2, 0, 2 * Math.PI, false);
	ctx.fillStyle = 'black';
	ctx.fill();

	ctx.beginPath();

	let offset: number = Math.PI * (1 / num_vertices);

	if (num_vertices % 2 != 0) {
		offset = Math.PI / 2 - 2 * offset;
	}

	for (let i = 1; i <= num_vertices; i++) {
		const rads: number = 2 * Math.PI * (i / num_vertices) + offset;
		const x: number = radius * Math.cos(rads);
		const y: number = -radius * Math.sin(rads);

		ctx.lineTo(x, y);
	}

	ctx.closePath();

	ctx.strokeStyle = 'black';
	ctx.stroke();

	ctx.restore();
};

export const animatePrisioners = (
	speed: number,
	maxDistance: number,
	ctx: CanvasRenderingContext2D,
	height: number,
	width: number
): (() => void) => {
	let handle: number;
	let lastTime: number = 0;

	const coords: number[][] = [];
	const directions: number[][] = [];

	const loop = (currentTime: number) => {
		if (lastTime === 0) lastTime = currentTime;
		const dt = (currentTime - lastTime) / 1000;
		lastTime = currentTime;

		const addPrisioner: boolean = Math.floor(Math.random() * 101) == 69;

		if (coords.length == 0 || (coords.length < 10 && addPrisioner)) {
			coords.push([0, 0]);
			directions.push(getRandomDirection());
		}

		for (let i: number = coords.length - 1; i >= 0; i--) {
			coords[i][0] += directions[i][0] * speed * dt;
			coords[i][1] += directions[i][1] * speed * dt;

			const dist = Math.sqrt(Math.pow(coords[i][0], 2) + Math.pow(coords[i][1], 2));

			if (dist > maxDistance) {
				coords.splice(i, 1);
				directions.splice(i, 1);
			}
		}

		drawPoints(coords, ctx, height, width);
		handle = requestAnimationFrame(loop);
	};

	handle = requestAnimationFrame(loop);
	return () => {
		ctx.clearRect(0, 0, width, handle);
		cancelAnimationFrame(handle);
	};
};

const getRandomDirection = (): number[] => {
	const radians: number = (Math.floor(Math.random() * 361) * (2 * Math.PI)) / 360;
	return [Math.cos(radians), Math.sin(radians)];
};

export const drawPoints = (
	coords: number[][],
	ctx: CanvasRenderingContext2D,
	height: number,
	width: number,
	radius: number | null = null
) => {
	ctx.clearRect(0, 0, height, width);
	ctx.save();

	ctx.translate(height / 2, width / 2);
	ctx.fillStyle = 'blue';

	for (let i: number = 0; i < coords.length; i++) {
		const [x, y] = coords[i];

		if (!radius) {
			ctx.fillRect(x - 4, y - 4, 8, 8);
			continue;
		}

		ctx.beginPath();
		ctx.arc(x, y, radius!, 0, 2 * Math.PI, false);
		ctx.fillStyle = 'rgba(255, 0, 0, 0.25)';
		ctx.fill();

		ctx.beginPath();
		ctx.arc(x - 2, y - 2, 4, 0, 2 * Math.PI, false);
		ctx.fillStyle = 'red';
		ctx.fill();
	}

	ctx.restore();
};

export const animateDrones = (
	speed: number,
	radius: number,
	radianPositions: number[],
	ctx: CanvasRenderingContext2D,
	height: number,
	width: number
): (() => void) => {
	let handle: number;
	let lastTime: number = 0;

	const angularVelocity: number = speed / radius;

	const loop = (currentTime: number) => {
		if (lastTime === 0) lastTime = currentTime;
		const dt = (currentTime - lastTime) / 1000;
		lastTime = currentTime;

		const points: number[][] = [];

		for (let i: number = radianPositions.length - 1; i >= 0; i--) {
			radianPositions[i] += angularVelocity * dt;
			const x = radius * Math.cos(radianPositions[i]);
			const y = -radius * Math.sin(radianPositions[i]);
			points.push([x, y]);
		}

		drawPoints(points, ctx, height, width, radius);
		handle = requestAnimationFrame(loop);
	};

	handle = requestAnimationFrame(loop);
	return () => {
		ctx.clearRect(0, 0, width, handle);
		cancelAnimationFrame(handle);
	};
};
