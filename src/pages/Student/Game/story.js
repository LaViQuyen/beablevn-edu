// src/story.js
// Cốt truyện "Hành Trình Trưởng Thành" — triết lý Be Able VN: "Học cách Trưởng thành".
// Nhân vật: MẦM XANH, một hạt mầm lớn dần thành CÂY qua 5 cấp học.
// Mỗi con quái = một thói quen / nỗi sợ bên trong; vũ khí = công cụ học tập;
// Lễ Nghĩa + Thái Độ = trái tim nhân cách (Trust & Discipline trong GTO).
// Văn phong: tinh tế, cô đọng, nhân văn — hiển thị trên nền HỒNG PHẤN, chữ ĐỎ ĐÔ.

// Lời mở đầu mỗi CẤP (hiện ở màn Bản Đồ, theo prog.rank)
export const RANK_STORY = [
  "Chương I · MẦM NON — Những bước đầu đời: tập đứng dậy, làm chủ cảm xúc, học sẻ chia.",
  "Chương II · TIỂU HỌC — Nét chữ, nết người: rèn nề nếp, sự cẩn thận và lòng tập trung.",
  "Chương III · THCS — Vững vàng giữa đám đông: bản lĩnh trước cám dỗ và áp lực.",
  "Chương IV · THPT — Ngưỡng cửa người lớn: giữ liêm chính, biết chọn lựa dưới áp lực.",
  "Chương V · ĐẠI HỌC — Tự viết đời mình: tự do đi cùng trách nhiệm và kỷ luật."
];

// Lời dẫn truyện mỗi ẢI/LỚP (hiện ở đầu màn chơi, theo stage 0..24)
export const LEVEL_STORY = [
  // — CẤP 1: MẦM NON —
  "Lần đầu rời vòng tay, đất trơn dưới đôi chân non. Bài học đầu đời: ngã rồi lại đứng lên.",
  "Cơn hờn dỗi như con thú đang ngủ. Mầm Xanh học đi thật khẽ qua cảm xúc của chính mình.",
  "“Của tôi!” — giữ khư khư thì mất, biết sẻ chia thì còn.",
  "Trùm Vòi Vĩnh: không mong muốn nào cũng cần được thỏa mãn ngay. Đó là bước lớn đầu tiên.",
  "Kiên nhẫn mở lối bí mật. Mầm Xanh nhận hai báu vật theo suốt đời: Lễ Nghĩa & Thái Độ.",
  // — CẤP 2: TIỂU HỌC —
  "Viết Ẩu vẩy mực che mờ tầm nhìn. Nét chữ là nết người; cẩu thả che mất lối đi.",
  "Quên Nhớ lặng lẽ xóa điều vừa học. Thứ không ôn lại sẽ tan biến — hãy ghi nhớ và trân trọng.",
  "Giữa trăm tiếng ồn xao nhãng, Mầm Xanh tập giữ lấy một điều: sự tập trung.",
  "Đến gần Lười Biếng, tay chân nặng như chì. Trì hoãn làm ta chậm dần đến khi đứng yên.",
  "Lạc Đề làm rối mọi nẻo đường. Em học giữ vững mục tiêu khi cả thế giới kéo mình chệch hướng.",
  "Sửa từng lỗi nhỏ, Mầm Xanh thấm thía: điều đúng đắn nằm ở những chi tiết.",
  // — CẤP 3: THCS —
  "Bắt Nạt khoác giáp hung hăng. Đối mặt kẻ mạnh cần kiên trì, không cần mạnh hơn.",
  "Một chặng không chiêu trò — chỉ còn em và năng lực thật. Trưởng thành là biết mình đang ở đâu.",
  "Mê Game ẩn mình, hiện ra khi đã quá gần. Cám dỗ nguy nhất là thứ ta không nhận ra.",
  "Chống Đối dội ngược mọi lời khuyên. Bản lĩnh là lắng nghe mà không đánh mất chính kiến.",
  "Đề Thi Vào 10 — phép thử cho tất cả những gì em đã rèn. Vượt qua, em bước vào ngưỡng cửa người lớn.",
  // — CẤP 4: THPT —
  "Áp lực ập tới, choáng váng giữa dòng. Hãy hít thở, đứng dậy và đi tiếp dù bị dồn ép.",
  "Quay Cóp rải đầy cám dỗ lối tắt. Gian dối luôn phát nổ dưới chân người đi.",
  "Thức Khuya rút cạn sức từng đêm. Đốt cháy mình không phải chăm chỉ — nỗ lực phải đi cùng giữ gìn.",
  "Đại Ma Vương — nỗi sợ “mình không đủ giỏi”. Kẻ thù lớn nhất là sự nghi ngờ chính mình.",
  // — CẤP 5: ĐẠI HỌC —
  "Lần đầu tự lập, mọi thứ “rớt mạng”. Em học tự đứng lên khi không còn ai dắt tay.",
  "Đường tương lai tối đen, không ai chỉ lối. Mầm Xanh tự thắp đèn và bước tiếp.",
  "Những việc trì hoãn dồn lại thành “nợ”. Em học trả từng chút, không bỏ cuộc.",
  "Tường lửa Deadline rượt sau lưng. Em học sống kỷ luật với thời gian — trụ cột của trưởng thành.",
  "Tứ Đại Trưởng Lão không để đánh bại, mà để được công nhận. Mầm Xanh đã thành CÂY — đủ vững che bóng cho những mầm sau."
];
