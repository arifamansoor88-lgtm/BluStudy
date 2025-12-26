const ConfirmModal = ({ setOpenModal, selectedMindmap, onConfirm }) => {
    return (
        <div className="w-screen h-screen bg-black/40 fixed flex justify-center items-center inset-0 z-[100] shadow-md">
            <div className="w-[448px] h-44 rounded-lg bg-white gap-2 flex flex-col justify-between p-4">
                <h3 className="text-lg">Delete Mindmap?</h3>
                <div>
                    <p>
                        This will delete <span className="font-semibold">{selectedMindmap.data?.title}.</span>
                    </p>
                    <p className="text-[14px] font-bold text-gray-400">
                        Once deleted, mindmap cannot be recovered.
                    </p>
                </div>
                <div className="w-full flex justify-end gap-4">
                    <button onClick={() => setOpenModal(false)} className="bg-gray-100 hover:bg-gray-200 py-1.5 px-4 rounded-xl shadow-sm">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="bg-red-500 text-white py-1.5 px-4 rounded-xl hover:bg-red-600 shadow-sm">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ConfirmModal;
