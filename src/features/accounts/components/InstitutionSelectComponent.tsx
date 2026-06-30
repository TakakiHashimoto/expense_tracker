type Props = {
  institutionName: string;
  plaidItemUuid: string;
  onClick: (id: string) => void;
};

function InstitutionSelectComponent({
  institutionName,
  plaidItemUuid,
  onClick,
}: Props) {
  const initialLetter = institutionName.slice(0, 1);
  return (
    <button
      className="group bg-surface-container-low p-8 rounded-3xl flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:bg-surface-variant hover:-translate-y-1 cursor-pointer"
      onClick={() => onClick(plaidItemUuid)}
    >
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center p-3">
        <span className="w-10 h-10 rounded-xl bg-[#117aca] flex items-center justify-center text-white font-bold text-lg">
          {initialLetter}
        </span>
      </div>
      <span className="font-headline-md text-on-surface text-center">
        {institutionName}
      </span>
    </button>
  );
}

export default InstitutionSelectComponent;
