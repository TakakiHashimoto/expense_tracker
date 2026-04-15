type props = {
  security: {
    question: string;
    answer: string;
    keys: { icon: string; explanation: string }[];
  };
};

function LandingSecurity({ security }: props) {
  return (
    <section>
      <h3>{security.question}</h3>
      <p>{security.answer}</p>
      <div>
        {security.keys.map((key) => (
          <div key={key.explanation}>
            <span>{key.icon}</span>
            <p>{key.explanation}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default LandingSecurity;
