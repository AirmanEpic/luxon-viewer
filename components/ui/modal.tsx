export function ModalBack(props: { children: React.ReactNode, onClose: () => void }) {
	return (
		<div className="deep-panel absolute left-0 top-0 z-50 w-full h-full backdrop-blur-sm" onClick={props.onClose}>
			{props.children}
		</div>
	);
}