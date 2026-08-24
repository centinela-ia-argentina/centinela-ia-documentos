'use client';

import { useEffect, useState } from 'react';

export function MaquinaEscribir({
	texto,
	velocidad = 45,
	className,
}: {
	texto: string;
	velocidad?: number;
	className?: string;
}) {
	const [mostrado, setMostrado] = useState('');

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setMostrado('');
		let i = 0;
		const id = setInterval(() => {
			i++;
			setMostrado(texto.slice(0, i));
			if (i >= texto.length) clearInterval(id);
		}, velocidad);
		return () => clearInterval(id);
	}, [texto, velocidad]);

	const terminado = mostrado.length >= texto.length;

	return (
		<span className={className}>
			{mostrado}
			{!terminado && (
				<span
					aria-hidden
					style={{
						display: 'inline-block',
						width: '0.6ch',
						marginLeft: '1px',
						animation: 'cursorParpadeo 0.8s steps(1) infinite',
					}}
				>
					▋
				</span>
			)}
			<style jsx>{`
				@keyframes cursorParpadeo {
					0%, 50% { opacity: 1; }
					50.01%, 100% { opacity: 0; }
				}
			`}</style>
		</span>
	);
}
