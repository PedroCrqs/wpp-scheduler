function mergeFormat(msg) {
  {
    return (
      msg
        // 1. Trocar emoji inicial
        .replace("⚡", "🔺")

        // 2. Adicionar 🏅 no título
        .replace(/\n\n\*/, "\n\n🏅*")

        // 3. Adicionar 🔹 na descrição (primeira linha após título)
        .replace(/\n\n🏅\*.*\n\n\*/, (match) => {
          return match.replace(/\n\n\*$/, "\n\n🔹*");
        })

        // 4. Adicionar 💰 no preço
        .replace(/\n\n\*R\$/, "\n\n💰*R$")
    );
  }
}

module.exports = { mergeFormat };
