import React from 'react';
import { Link } from 'react-router-dom';

// Stub tạm trong lúc port, sẽ được thay bằng bản đầy đủ
const IntroCoach = () => (
  <div className="py-24 text-center text-slate-500">
    <p>Công cụ đang được hoàn thiện…</p>
    <Link to="/student/resources" className="text-[#2B6830] font-bold">← Quay lại</Link>
  </div>
);

export default IntroCoach;
