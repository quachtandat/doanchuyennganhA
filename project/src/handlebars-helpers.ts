export const handlebarsHelpers = {
  // Tăng index lên 1 (dùng cho số thứ tự)
  inc: function (value: number) {
    return parseInt(value.toString()) + 1;
  },

  // So sánh bằng
  eq: function (a: any, b: any) {
    return a === b;
  },

  // Kiểm tra chẵn lẻ
  isEven: function (value: number) {
    return value % 2 === 0;
  },

  // So sánh nhỏ hơn
  lt: function (a: number, b: number) {
    return a < b;
  },

  // Format date
  formatDate: function (date: Date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
  },

  // Format number (1000 -> 1K, 1000000 -> 1M)
  formatNumber: function (num: number) {
    if (!num) return '0';
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  },
};
