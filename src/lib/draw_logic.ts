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

	let offset: number = Math.PI * (1 / num_vertices);

	if (num_vertices % 2 != 0) {
		offset = Math.PI / 2 - 2 * offset;
	}

	for (let i = 1; i <= num_vertices; i++) {
		const rads: number = 2 * Math.PI * (i / num_vertices) + offset;
		const x: number = radius * Math.cos(rads);
		const y: number = -radius * Math.sin(rads);

		if (i == 1) {
			console.log(rads);
			console.log(x);
			console.log(y);
		}

		ctx.lineTo(x, y);
	}

	ctx.closePath();

	ctx.strokeStyle = 'black';
	ctx.stroke();

	ctx.restore();
};
