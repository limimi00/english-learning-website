import unittest

from tools.convert_docx import parse_lesson_text


class ConvertDocxTests(unittest.TestCase):
    def test_parse_lesson_text_extracts_vocab_sentences_and_questions(self):
        text = """
New words:
    • upstairs
    • living room
    • turn on/off

Examples:
1. There is a problem with my bicycle.
2. Are there any eggs in our fridge?

Answer the questions:
1. Where do you live?
2. What do you have for breakfast?
"""

        result = parse_lesson_text(text, lesson_id="part-6", title="Part 6")

        self.assertEqual(
            [item["en"] for item in result["vocabulary"]],
            ["upstairs", "living room", "turn on/off"],
        )
        self.assertIn("There is a problem with my bicycle.", result["sentences"])
        self.assertIn("Where do you live?", result["questions"])


if __name__ == "__main__":
    unittest.main()
